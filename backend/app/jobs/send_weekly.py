"""
周一 9:00（北京时间）由 cron 调用：
  cd backend && python -m app.jobs.send_weekly
"""
from __future__ import annotations

import hashlib
import json
import os

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import IssueStatus, SendLog, Subscriber, SubscriberStatus, WeeklyIssue
from app.services.digest_builder import (
    append_subscription_footer,
    filter_payload_for_keywords,
    parse_payload_json,
    render_issue_email,
)
from app.services.email_service import send_email
from app.timeutil import current_period_monday


def _kind(base: str, email: str) -> str:
    # DuckDB-backed variants may not provide stable auto-increment ids.
    # Encode a short email hash into kind so dedupe works without relying on subscriber_id.
    h = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:16]
    return f"{base}:{h}"


def run(db: Session) -> None:
    period = current_period_monday()
    issue = db.execute(
        select(WeeklyIssue).where(WeeklyIssue.period_start == period, WeeklyIssue.status == IssueStatus.ready.value)
    ).scalar_one_or_none()
    if not issue:
        print(f"No ready issue for period {period}.")
        return

    subs = db.execute(
        select(Subscriber).where(
            Subscriber.status == SubscriberStatus.active.value,
            Subscriber.confirmed_at.is_not(None),
        )
    ).scalars().all()
    target_email = (os.getenv("TARGET_EMAIL") or "").strip().lower()
    dry_run = (os.getenv("DRY_RUN") or "").strip() in ("1", "true", "True", "YES", "yes")
    if target_email:
        subs = [s for s in subs if (s.email or "").strip().lower() == target_email]
    payload = parse_payload_json(issue.payload_json)
    settings = get_settings()
    pub = settings.public_app_url.rstrip("/")

    for sub in subs:
        k = _kind("weekly", sub.email)
        sent = db.execute(
            select(SendLog).where(
                SendLog.issue_id == issue.id,
                SendLog.kind == k,
            )
        ).scalar_one_or_none()
        if sent:
            continue

        kws: list[str] = json.loads(sub.keywords_json or "[]")
        filtered, matched = filter_payload_for_keywords(payload, kws)
        banner = None
        if kws and not matched:
            banner = "本周期暂无与关键词直接匹配的内容，以下为本期全文。"
        html_body, text_body = render_issue_email(
            filtered,
            sub.mode,
            keyword_banner=banner,
            recipient_email=sub.email,
        )
        html_body = append_subscription_footer(html_body, settings.public_app_url, sub.unsubscribe_token, sub.manage_token)
        text_body += f"\n\n退订: {pub}/api/unsubscribe?token={sub.unsubscribe_token}"
        subject = f"AI Pulse · 周刊 · {period.isoformat()}"
        if dry_run:
            print(f"[DRY_RUN] Would send weekly to {sub.email} (kind={k})")
            continue
        send_email(sub.email, subject, html_body, text_body)
        db.execute(insert(SendLog).values(subscriber_id=sub.id, issue_id=issue.id, kind=k))
        db.commit()
        print(f"Sent weekly to {sub.email} (kind={k})")

    print("send_weekly done.")


def main():
    db = SessionLocal()
    try:
        run(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
