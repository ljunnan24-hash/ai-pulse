"""
周一 00:30（北京时间）由 cron 调用：
  cd backend && python -m app.jobs.generate_weekly
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import IssueStatus, RawItem, WeeklyIssue
from app.services.crawler_service import collect_all_feed_items
from app.services.summarizer_service import normalize_payload, payload_to_texts, summarize_items
from app.timeutil import current_period_monday


def run(db: Session) -> None:
    period = current_period_monday()
    existing_ready = db.execute(
        select(WeeklyIssue).where(WeeklyIssue.period_start == period, WeeklyIssue.status == IssueStatus.ready.value)
    ).scalar_one_or_none()
    if existing_ready:
        print(f"Issue for {period} already ready, skip.")
        return

    issue = db.execute(select(WeeklyIssue).where(WeeklyIssue.period_start == period)).scalar_one_or_none()
    if not issue:
        issue = WeeklyIssue(
            period_start=period,
            simple_text="",
            normal_text="",
            glossary_json="[]",
            payload_json="{}",
            status=IssueStatus.draft.value,
        )
        db.add(issue)
        db.commit()
        db.refresh(issue)
    else:
        issue.status = IssueStatus.draft.value
        db.commit()

    db.execute(delete(RawItem).where(RawItem.issue_id == issue.id))
    db.commit()

    items = collect_all_feed_items()
    if not items:
        print("No feed items collected; abort without marking ready.")
        return

    for it in items:
        db.add(
            RawItem(
                issue_id=issue.id,
                source=it.get("source", ""),
                title=it.get("title", ""),
                summary=it.get("summary", ""),
                link=it.get("link", ""),
                published_at=it.get("published_at"),
                heat_score=int(it.get("heat_score") or 0),
            )
        )
    db.commit()

    try:
        payload = summarize_items(items)
    except Exception as e:
        print(f"Summarizer failed: {e}")
        raise

    payload = normalize_payload(payload)
    simple_text, normal_text, glossary_json = payload_to_texts(payload)

    issue.simple_text = simple_text
    issue.normal_text = normal_text
    issue.glossary_json = glossary_json
    issue.payload_json = json.dumps(payload, ensure_ascii=False)
    issue.status = IssueStatus.ready.value
    issue.ready_at = datetime.now(timezone.utc)
    db.commit()
    print(f"Weekly issue {issue.id} for {period} marked ready.")


def main():
    db = SessionLocal()
    try:
        run(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
