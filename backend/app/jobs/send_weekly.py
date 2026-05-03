"""
周一 9:00（北京时间）由 cron 调用：
  cd backend && python -m app.jobs.send_weekly

测试只发固定收件人（默认 2089128910@qq.com），无需改 .env：
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
from app.services.digest_builder import (
    append_subscription_footer,
    build_payload_from_raw_items,
    render_issue_email,
)
from app.services.email_service import send_email
from app.services.issue_events_service import fetch_digest_candidates
from app.timeutil import current_period_monday, weekly_issue_heading_display

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
    raw_items = fetch_digest_candidates(db, issue.id)
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

        kws: list[str] = json.loads(sub.keywords_json or "[]")
        filtered, matched = build_payload_from_raw_items(raw_items, mode=sub.mode, keywords=kws)
        banner = None
        if kws and not matched:
            banner = "本周期暂无与关键词直接匹配的内容，以下为本期最高分内容。"
        heading = weekly_issue_heading_display(issue.period_start) if issue.period_start else None
        html_body, text_body = render_issue_email(
            filtered,
            sub.mode,
            keyword_banner=banner,
            recipient_email=sub.email,
            issue_heading=heading,
        )
        html_body = append_subscription_footer(html_body, settings.public_app_url, sub.unsubscribe_token, sub.manage_token)
        unsub_url = f"{pub}/api/unsubscribe?token={sub.unsubscribe_token}"
        text_body += f"\n\n退订: {unsub_url}"
        subject = heading if heading else f"AI Pulse · 周刊 · {period.isoformat()}"
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
        help="仅发给 weekly_test_inbox（默认 2089128910@qq.com）；生产 cron 不要带此参数",
    )
    args = ap.parse_args()
    db = SessionLocal()
    try:
        run(db, cli_test_only=args.test)
    finally:
        db.close()


if __name__ == "__main__":
    main()
