"""
周刊未发送排查（在能连 RDS 的服务器上运行）：
  cd backend && .venv/bin/python scripts/diagnose_weekly_send.py
"""

from __future__ import annotations

import json
from datetime import timedelta

from sqlalchemy import func, select, desc

from app.config import get_settings
from app.database import SessionLocal
from app.models import SendLog, Subscriber, SubscriberStatus, WeeklyIssue, WeeklyIssueSnapshot, WeeklyReport
from app.services.email_notification import is_email_payload_sendable, parse_stored_payload
from app.timeutil import current_period_monday, now_beijing


def main() -> None:
    period = current_period_monday()
    settings = get_settings()
    db = SessionLocal()
    try:
        print("=== 时间 / 配置 ===")
        print(f"北京时间: {now_beijing().isoformat()}")
        print(f"本期 period_start: {period}")
        print(f"WEEKLY_SOURCE: {settings.weekly_source}")
        print(f"MULTI_AGENT_WEEKLY: {settings.multi_agent_weekly}")
        print(f"MAIL_DRY_RUN: {settings.mail_dry_run}")
        print(f"SMTP: {'OK' if settings.smtp_user and settings.smtp_password else 'MISSING'}")
        print(f"WEEKLY_SEND_TEST_MODE: {settings.weekly_send_test_mode}")

        issues = list(
            db.scalars(
                select(WeeklyIssue).where(WeeklyIssue.period_start == period).order_by(WeeklyIssue.id)
            ).all()
        )
        print("\n=== weekly_issues 本期 ===")
        if not issues:
            print("  (无行) → generate_weekly 可能从未跑成功")
        for i in issues:
            print(f"  id={i.id} status={i.status!r} ready_at={i.ready_at}")

        ready = next((i for i in issues if i.status == "ready"), None)
        if not ready:
            print("\n【结论】本期无 ready → send_weekly 会直接退出，不会发信")
        else:
            _, ep = parse_stored_payload(ready.payload_json or "{}")
            sendable = is_email_payload_sendable(ep, settings=settings)
            print(f"\n=== ready issue id={ready.id} ===")
            print(f"email_payload 可发送: {sendable}")
            if not sendable and ep:
                print("  (email_payload 校验未通过，订阅者会被逐个 skip)")

        report = db.scalars(
            select(WeeklyReport).where(WeeklyReport.report_date == period)
        ).first()
        print("\n=== weekly_reports 对外页 ===")
        if report:
            print(f"  report_date={report.report_date} status={getattr(report, 'status', '?')}")
        else:
            print("  (无) → 页面 /weekly/{date} 会 404")

        latest = db.scalars(
            select(WeeklyReport)
            .where(WeeklyReport.status == "published")
            .order_by(desc(WeeklyReport.report_date))
        ).first()
        if latest:
            print(f"  最近已发布: {latest.report_date}")

        snaps = list(
            db.scalars(
                select(WeeklyIssueSnapshot)
                .where(WeeklyIssueSnapshot.period_start == period)
                .order_by(desc(WeeklyIssueSnapshot.created_at))
                .limit(3)
            ).all()
        )
        print("\n=== 本期快照 ===")
        if not snaps:
            print("  (无) → 本期从未成功 commit 过 generate_weekly")
        for s in snaps:
            print(f"  id={s.id} created_at={s.created_at} source={s.source}")

        n_subs = db.scalar(
            select(func.count())
            .select_from(Subscriber)
            .where(
                Subscriber.status == SubscriberStatus.active.value,
                Subscriber.confirmed_at.is_not(None),
            )
        )
        print(f"\n=== 已确认订阅者: {n_subs} ===")

        logs = list(
            db.scalars(
                select(SendLog)
                .where(SendLog.kind.like(f"weekly:{period}%"))
                .order_by(desc(SendLog.id))
                .limit(10)
            ).all()
        )
        print(f"\n=== send_logs 本期 (weekly:{period}*) ===")
        if not logs:
            print("  (无) → send_weekly 未成功写入任何发送记录")
        for lg in logs:
            print(f"  kind={lg.kind}")

        prev = period - timedelta(days=7)
        prev_logs = db.scalar(
            select(func.count()).select_from(SendLog).where(SendLog.kind.like(f"weekly:{prev}%"))
        )
        print(f"\n上期 {prev} send_logs 条数: {prev_logs}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
