"""
每期周刊每次生成成功写入 weekly_issue_snapshots 一行（追加，不覆盖），便于对比排查。
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.models import WeeklyIssue, WeeklyIssueSnapshot


def append_weekly_issue_snapshot(
    db: Session,
    issue: WeeklyIssue,
    *,
    source: str,
    audit_report: dict[str, Any] | None = None,
) -> WeeklyIssueSnapshot | None:
    bind = db.get_bind()
    if bind is not None:
        insp = inspect(bind)
        if not insp.has_table("weekly_issue_snapshots"):
            print(
                "WARN: 表 weekly_issue_snapshots 不存在，已跳过历史快照。"
                "请执行 sql/migrations/2026-05-05_weekly_issue_snapshots.sql"
            )
            return None

    audit_raw: str | None = None
    if audit_report is not None:
        try:
            audit_raw = json.dumps(audit_report, ensure_ascii=False)
        except Exception:
            audit_raw = None

    snap = WeeklyIssueSnapshot(
        issue_id=int(issue.id),
        period_start=issue.period_start,
        simple_text=issue.simple_text or "",
        normal_text=issue.normal_text or "",
        glossary_json=issue.glossary_json or "[]",
        payload_json=issue.payload_json or "{}",
        status=issue.status or "",
        ready_at=issue.ready_at,
        source=(source or "unknown")[:64],
        audit_report_json=audit_raw,
    )
    db.add(snap)
    return snap
