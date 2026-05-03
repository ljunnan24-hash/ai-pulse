from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.models import IssueEvent, RawItem
from app.services.digest_builder import classify_item_section
from app.services.event_merge_service import merge_items_to_events


def raw_item_to_dict(r: RawItem) -> dict[str, Any]:
    d: dict[str, Any] = {
        "id": r.id,
        "title": r.title or "",
        "summary": r.summary or "",
        "link": r.link or "",
        "heat_score": int(r.heat_score or 0),
        "score_total": int(r.score_total or 0),
        "_score_total": int(r.score_total or 0),
        "source_type": r.source_type or "rss",
        "source": r.source or "",
        "published_at": r.published_at,
    }
    ex = getattr(r, "extra_json", None)
    if ex:
        try:
            obj = json.loads(ex)
            if isinstance(obj, dict):
                if obj.get("source_name"):
                    d["source_name"] = obj["source_name"]
                if obj.get("feed_url"):
                    d["feed_url"] = obj["feed_url"]
                if obj.get("language"):
                    d["language"] = obj["language"]
                if obj.get("metrics") is not None:
                    d["metrics"] = obj["metrics"]
                if obj.get("author"):
                    d["author"] = obj["author"]
        except Exception:
            pass
    return d


def rebuild_issue_events(db: Session, issue_id: int) -> int:
    """
    读取本期全部 RawItem，按 URL/标题聚合成 IssueEvent，写库并回写 raw_items.event_id。
    幂等：会先清空本期事件的归属再重建。
    """
    rows = (
        db.execute(select(RawItem).where(RawItem.issue_id == issue_id).order_by(RawItem.id.asc())).scalars().all()
    )
    db.execute(update(RawItem).where(RawItem.issue_id == issue_id).values(event_id=None))
    db.execute(delete(IssueEvent).where(IssueEvent.issue_id == issue_id))
    db.commit()

    if not rows:
        return 0

    dicts = [raw_item_to_dict(r) for r in rows]
    entities = merge_items_to_events(dicts, max_events=200)

    created = 0
    for ent in entities:
        merged = ent.merged_item()
        scores = []
        heats = []
        pdates: list[datetime] = []
        for it in ent.items:
            scores.append(int(it.get("score_total") or it.get("_score_total") or 0))
            heats.append(int(it.get("heat_score") or 0))
            pd = it.get("published_at")
            if isinstance(pd, datetime):
                pdates.append(pd)
        score_total = max(scores) if scores else 0
        heat_max = max(heats) if heats else 0
        pub_at = max(pdates) if pdates else None

        cat = classify_item_section(str(merged.get("title") or ""), str(merged.get("summary") or ""))

        sources: list[dict[str, Any]] = []
        for it in ent.items:
            rid = it.get("id")
            if rid is None:
                continue
            sources.append(
                {
                    "raw_item_id": int(rid),
                    "source_type": str(it.get("source_type") or ""),
                    "source": str(it.get("source") or ""),
                    "link": str(it.get("link") or it.get("url") or ""),
                    "title": str(it.get("title") or "")[:300],
                }
            )

        ie = IssueEvent(
            issue_id=issue_id,
            event_key=ent.event_key,
            canonical_title=str(merged.get("title") or "")[:512],
            canonical_url=str(merged.get("link") or "")[:1024],
            summary_merged=str(merged.get("summary") or ""),
            category=cat,
            fact_status="unverified",
            confidence=0.65 if len(sources) > 1 else 0.45,
            score_total=score_total,
            heat_score=heat_max,
            published_at=pub_at,
            sources_json=json.dumps(sources, ensure_ascii=False),
            enrichment_json="{}",
        )
        db.add(ie)
        db.flush()

        for it in ent.items:
            rid = it.get("id")
            if rid is None:
                continue
            db.execute(update(RawItem).where(RawItem.id == int(rid)).values(event_id=ie.id))

        created += 1

    db.commit()
    return created


def fetch_digest_candidates(db: Session, issue_id: int) -> list[Any]:
    """
    周报/digest 选题池：优先使用聚合后的 IssueEvent（去重后的一条一事）；
    若尚无事件行（未跑迁移或旧数据），回退为 RawItem。
    """
    try:
        evs = (
            db.execute(
                select(IssueEvent)
                .where(IssueEvent.issue_id == issue_id)
                .order_by(IssueEvent.score_total.desc(), IssueEvent.heat_score.desc())
            )
            .scalars()
            .all()
        )
    except Exception:
        evs = []
    if evs:
        return list(evs)
    return (
        db.execute(select(RawItem).where(RawItem.issue_id == issue_id).order_by(RawItem.score_total.desc()))
        .scalars()
        .all()
    )


def raw_rows_for_summarize_prompt(rows: list[RawItem]) -> list[dict[str, Any]]:
    return [
        {
            "title": r.title or "",
            "summary": r.summary or "",
            "link": r.link or "",
            "source": r.source or "",
            "source_type": r.source_type or "rss",
            "heat_score": int(r.heat_score or 0),
            "_score_total": int(r.score_total or 0),
        }
        for r in rows
    ]


def candidates_to_summarize_input(candidates: list[Any]) -> list[dict[str, Any]]:
    """digest 候选 ORM 行 → summarize_items 用字典列表。"""
    if not candidates:
        return []
    if isinstance(candidates[0], IssueEvent):
        return issue_events_for_summarize_prompt(candidates)
    if isinstance(candidates[0], RawItem):
        return raw_rows_for_summarize_prompt(candidates)
    return []


def issue_events_for_summarize_prompt(events: list[IssueEvent]) -> list[dict[str, Any]]:
    """转为 summarize_items / LLM 使用的字典列表（保留评分字段）。"""
    out: list[dict[str, Any]] = []
    for e in events:
        src = ""
        try:
            arr = json.loads(e.sources_json or "[]")
            if isinstance(arr, list) and arr:
                src = str(arr[0].get("source") or arr[0].get("source_type") or "")
        except Exception:
            pass
        out.append(
            {
                "title": e.canonical_title,
                "summary": e.summary_merged,
                "link": e.canonical_url,
                "source": src,
                "source_type": "event",
                "heat_score": e.heat_score,
                "_score_total": e.score_total,
                "_event_key": e.event_key,
            }
        )
    return out
