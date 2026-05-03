"""
检查 IssueEvent 相关迁移是否已应用。
用法: cd backend && python -m scripts.check_db_schema
"""
from __future__ import annotations

import sys

from sqlalchemy import inspect

from app.database import engine


def main() -> int:
    insp = inspect(engine)
    if not insp.has_table("issue_events"):
        print("FAIL: table issue_events missing — run sql/migrations/2026-05-02_issue_events.sql")
        return 1
    cols = {c["name"] for c in insp.get_columns("raw_items")}
    if "event_id" not in cols:
        print("FAIL: raw_items.event_id missing — run sql/migrations/2026-05-02_issue_events.sql")
        return 1
    if "extra_json" not in cols:
        print(
            "WARN: raw_items.extra_json missing — run sql/migrations/2026-05-03_raw_items_extra_json.sql "
            "(crawler metadata / PRD RawItem 扩展)"
        )
    print("OK: issue_events table and raw_items.event_id present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
