from __future__ import annotations

import argparse
import json
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import IssueStatus, WeeklyIssue
from app.services.issue_events_service import fetch_digest_candidates
from app.services.multi_agent_orchestrator import MultiAgentOrchestrator
from app.services.summarizer_service import normalize_payload
from app.timeutil import current_period_monday


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--period", default="", help="period_start YYYY-MM-DD (default current period)")
    p.add_argument("--top-n", type=int, default=20)
    p.add_argument("--out", default="out_multi_agent", help="output dir")
    p.add_argument(
        "--input-json",
        default="",
        help="optional: path to a JSON file containing raw_items array; if set, DB is not used",
    )
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Mode 1: run from JSON input (no DB needed)
    if args.input_json:
        p = Path(args.input_json)
        if not p.exists():
            print(f"--input-json not found: {p}")
            return 2
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Failed to parse --input-json: {e}")
            return 2
        if isinstance(data, dict) and "raw_items" in data:
            raw_items = data.get("raw_items")
        else:
            raw_items = data
        if not isinstance(raw_items, list) or not raw_items:
            print("--input-json must be a JSON array of raw_items, or {\"raw_items\": [...]} with non-empty list")
            return 2

        orch = MultiAgentOrchestrator()
        res = orch.build(raw_items=raw_items, top_n=int(args.top_n))

        payload = normalize_payload(res.payload if isinstance(res.payload, dict) else {})
        (out_dir / "payload.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        (out_dir / "audit_report.json").write_text(
            json.dumps(res.audit_report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out_dir / "artifacts.json").write_text(json.dumps(res.artifacts, ensure_ascii=False, indent=2), encoding="utf-8")

        print(f"Wrote: {out_dir / 'payload.json'}")
        print(f"Wrote: {out_dir / 'audit_report.json'}")
        print(f"Wrote: {out_dir / 'artifacts.json'}")
        return 0

    period = current_period_monday()
    if args.period:
        try:
            import datetime as _dt

            period = _dt.date.fromisoformat(args.period)
        except Exception:
            print("Invalid --period. Use YYYY-MM-DD.")
            return 2

    db = SessionLocal()
    try:
        issue = db.execute(
            select(WeeklyIssue).where(WeeklyIssue.period_start == period, WeeklyIssue.status == IssueStatus.ready.value)
        ).scalar_one_or_none()
        if not issue:
            # allow draft issues
            issue = db.execute(select(WeeklyIssue).where(WeeklyIssue.period_start == period)).scalar_one_or_none()
        if not issue:
            print(f"No issue row for period {period}. Run generate_weekly first.")
            return 1

        digest_candidates = fetch_digest_candidates(db, issue.id)
        if not digest_candidates:
            print(f"No digest candidates for issue {issue.id}. Run generate_weekly first.")
            return 1

        orch = MultiAgentOrchestrator()
        res = orch.build(raw_items=digest_candidates, top_n=int(args.top_n))

        payload = normalize_payload(res.payload if isinstance(res.payload, dict) else {})
        (out_dir / "payload.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        (out_dir / "audit_report.json").write_text(
            json.dumps(res.audit_report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out_dir / "artifacts.json").write_text(json.dumps(res.artifacts, ensure_ascii=False, indent=2), encoding="utf-8")

        print(f"Wrote: {out_dir / 'payload.json'}")
        print(f"Wrote: {out_dir / 'audit_report.json'}")
        print(f"Wrote: {out_dir / 'artifacts.json'}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

