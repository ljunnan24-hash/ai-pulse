"""
周一凌晨由 cron 调用（推荐北京时间 05:00，须晚于 generate_weekly，见 deploy/crontab.example）：
  cd backend && python -m app.jobs.send_weekly

测试只发固定收件人（默认 test@example.com，可通过 WEEKLY_TEST_INBOX 覆盖），无需改生产收件人：
  python -m app.jobs.send_weekly --test
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
from smtplib import SMTPDataError

from sqlalchemy import case, insert, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import IssueStatus, SendLog, Subscriber, SubscriberStatus, WeeklyIssue
from app.services.digest_builder import append_subscription_footer
from app.services.email_notification import parse_stored_payload, try_render_stored_notification
from app.services.email_service import send_email
from app.services.email_tracking import inject_weekly_email_tracking
from app.timeutil import current_period_monday

logger = logging.getLogger("uvicorn.error")


def _kind(base: str, email: str) -> str:
    # DuckDB-backed variants may not provide stable auto-increment ids.
    # Encode a short email hash into kind so dedupe works without relying on subscriber_id.
    h = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:16]
    return f"{base}:{h}"

def _issue_key(issue: WeeklyIssue) -> str:
    ps = getattr(issue, "period_start", None)
    if ps is not None:
        try:
            return ps.isoformat()
        except Exception:
            return str(ps)
    ra = getattr(issue, "ready_at", None)
    if ra is not None:
        try:
            return ra.isoformat()
        except Exception:
            return str(ra)
    return "unknown"


def run(db: Session, *, cli_test_only: bool = False) -> None:
    period = current_period_monday()
    issue = db.execute(
        select(WeeklyIssue)
        .where(WeeklyIssue.period_start == period, WeeklyIssue.status == IssueStatus.ready.value)
        .order_by(
            case((WeeklyIssue.ready_at.is_(None), 1), else_=0),
            WeeklyIssue.ready_at.desc(),
            WeeklyIssue.id.desc(),
        )
    ).scalars().first()
    if not issue:
        print(f"No ready issue for period {period}.")
        return

    settings = get_settings()
    subs = db.execute(
        select(Subscriber).where(
            Subscriber.status == SubscriberStatus.active.value,
            Subscriber.confirmed_at.is_not(None),
        )
    ).scalars().all()
    dry_run = (os.getenv("DRY_RUN") or "").strip() in ("1", "true", "True", "YES", "yes")

    only_to: str | None = None
    if cli_test_only:
        only_to = (settings.weekly_test_inbox or "").strip().lower()
        print(f"send_weekly: --test，仅发送至 {only_to}")
        logger.warning("send_weekly: CLI --test, only recipient %s", only_to)
    elif settings.weekly_send_test_mode:
        only_to = (settings.weekly_test_inbox or "").strip().lower()
        print(f"send_weekly: WEEKLY_SEND_TEST_MODE — only recipient {only_to}")
        logger.warning("send_weekly: WEEKLY_SEND_TEST_MODE=1, only sending to %s", only_to)
    else:
        only_to = (settings.target_email or os.getenv("TARGET_EMAIL") or "").strip().lower() or None

    if only_to:
        subs = [s for s in subs if (s.email or "").strip().lower() == only_to]
        if not subs:
            if cli_test_only:
                hint = "--test"
            elif settings.weekly_send_test_mode:
                hint = "WEEKLY_SEND_TEST_MODE"
            else:
                hint = "TARGET_EMAIL"
            msg = (
                f"{hint} 指向 {only_to}，但 subscribers 中无该已确认用户。"
                " 请用该邮箱完成订阅确认，或去掉 --test / 关闭环境里的测试开关 / 清空 TARGET_EMAIL。"
            )
            print(f"ERROR: {msg}")
            logger.error(msg)
            return
    pub = settings.public_app_url.rstrip("/")

    if not dry_run and (not settings.smtp_user or not settings.smtp_password):
        msg = "SMTP 未配置（smtp_user / smtp_password 为空），无法发信。请检查 backend/.env 或设置 MAIL_DRY_RUN=1 仅日志。"
        print(f"ERROR: {msg}")
        logger.error(msg)
        return

    for sub in subs:
        issue_key = _issue_key(issue)
        k = _kind(f"weekly:{issue_key}", sub.email)
        sent = db.execute(select(SendLog).where(SendLog.kind == k)).scalar_one_or_none()
        if sent:
            continue

        notification = try_render_stored_notification(
            issue.payload_json or "{}",
            recipient_email=sub.email,
            settings=settings,
        )
        if not notification:
            logger.warning(
                "send_weekly skip %s: no valid email_payload for issue %s",
                sub.email,
                getattr(issue, "id", None),
            )
            continue
        subject, html_body, text_body = notification
        html_body = append_subscription_footer(html_body, settings.public_app_url, sub.unsubscribe_token, sub.manage_token)
        _, ep = parse_stored_payload(issue.payload_json or "{}")
        main_link = str((ep or {}).get("main_link") or "").strip()
        if main_link:
            html_body = inject_weekly_email_tracking(
                html_body,
                main_link=main_link,
                subscriber_id=sub.id,
                weekly_issue_id=issue.id,
                report_date_iso=issue.period_start.isoformat(),
                settings=settings,
            )
        unsub_url = f"{pub}/api/unsubscribe?token={sub.unsubscribe_token}"
        text_body += f"\n\n退订: {unsub_url}"
        if dry_run:
            print(f"[DRY_RUN] Would send weekly to {sub.email} (kind={k})")
            continue
        try:
            send_email(sub.email, subject, html_body, text_body, list_unsubscribe_url=unsub_url)
            db.execute(insert(SendLog).values(subscriber_id=sub.id, issue_id=issue.id, kind=k))
            db.commit()
            print(f"Sent weekly to {sub.email} (kind={k})")
        except SMTPDataError as exc:
            # 直连邮件等网关按内容拒信（554 spam/policy），不应阻断其余订阅者
            logger.error("send_weekly: SMTP rejected message for %s (spam/policy): %s", sub.email, exc)
            db.rollback()
            print(f"ERROR: SMTP rejected for {sub.email}: {exc}")
            continue
        except RuntimeError as exc:
            logger.error("send_weekly: mail failed for %s: %s", sub.email, exc)
            db.rollback()
            print(f"ERROR: send_weekly aborted — {exc}")
            return
        except Exception as exc:
            logger.exception("send_weekly: unexpected error for %s", sub.email)
            db.rollback()
            print(f"ERROR: send_weekly failed for {sub.email}: {exc}")

    print("send_weekly done.")


def main():
    ap = argparse.ArgumentParser(description="发送周刊邮件（send_weekly）")
    ap.add_argument(
        "--test",
        action="store_true",
        help="仅发给 weekly_test_inbox（默认 test@example.com）；生产 cron 不要带此参数",
    )
    args = ap.parse_args()
    db = SessionLocal()
    try:
        run(db, cli_test_only=args.test)
    finally:
        db.close()


if __name__ == "__main__":
    main()
