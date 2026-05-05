"""
Build weekly issue payload via multi-agent orchestrator.

Manual run:
  cd backend && python -m app.jobs.build_weekly_multi_agent

Env overrides:
  PERIOD_START=YYYY-MM-DD   (optional)
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import IssueStatus, WeeklyIssue
from app.services.issue_events_service import fetch_digest_candidates
from app.services.weekly_issue_snapshot import append_weekly_issue_snapshot
from app.services.multi_agent_orchestrator import MultiAgentOrchestrator
from app.services.summarizer_service import normalize_payload, payload_to_texts
from app.timeutil import current_period_monday


def _parse_period(s: str) -> date | None:
    s = (s or "").strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except Exception:
        return None


def run(db: Session) -> None:
    period = _parse_period(os.getenv("PERIOD_START") or "") or current_period_monday()

    issue = db.execute(select(WeeklyIssue).where(WeeklyIssue.period_start == period)).scalar_one_or_none()
    if not issue:
        print(f"No issue row for period {period}. Run generate_weekly first.")
        return

    digest_candidates = fetch_digest_candidates(db, issue.id)
    if not digest_candidates:
        print(f"No digest candidates for issue {issue.id}. Run generate_weekly first.")
        return

    orch = MultiAgentOrchestrator()
    res = orch.build(
        raw_items=digest_candidates,
        top_n=20,
        report_date=period,
        db=db,
    )

    payload = normalize_payload(res.payload)
    simple_text, normal_text, glossary_json = payload_to_texts(payload)

    issue.payload_json = json.dumps(payload, ensure_ascii=False)
    issue.simple_text = simple_text
    issue.normal_text = normal_text
    issue.glossary_json = glossary_json
    issue.status = IssueStatus.ready.value
    issue.ready_at = datetime.now(timezone.utc)
    append_weekly_issue_snapshot(
        db,
        issue,
        source="build_weekly_multi_agent",
        audit_report=res.audit_report if isinstance(res.audit_report, dict) else None,
    )
    db.commit()

    # Persist audit report as a JSON blob inside payload_json? (kept separate by default)
    audit_path = os.path.join(os.getcwd(), f"audit_report_{period.isoformat()}.json")
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(res.audit_report, f, ensure_ascii=False, indent=2)
    print(f"Wrote audit report: {audit_path}")
    print(f"Weekly issue {issue.id} for {period} updated via multi-agent.")


def main():
    db = SessionLocal()
    try:
        run(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()

