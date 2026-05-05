"""
全局事件合并：从 raw_items（通常为 issue_id NULL 的每日抓取） upsert 到 global_events。
"""

from __future__ import annotations

import json
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GlobalEvent, GlobalEventSource, RawItem
from app.services.digest_builder import classify_item_section
from app.services.event_merge_service import _canonical_url, _norm_title
from app.services.ranking_score import (
    compute_ranking_score,
    freshness_from_published,
    heat_normalized,
    source_count_component,
    trust_from_source_type,
    user_value_from_raw_score,
)

_log = logging.getLogger("uvicorn.error")

TITLE_SIM_THRESHOLD = 0.82
MERGE_HOURS = 72


def _title_sim(a: str, b: str) -> float:
    return SequenceMatcher(None, (a or "").lower().strip(), (b or "").lower().strip()).ratio()


def map_global_category(section_cn: str, source_type: str) -> str:
    st = (source_type or "").lower().strip()
    if st == "github":
        return "open_source"
    s = section_cn or ""
    if s == "大模型更新":
        return "model"
    if s == "工具/产品":
        return "tool"
    if s == "行业动态":
        return "industry"
    return "application"


def compute_stable_key(link: str, title: str) -> str:
    u = _canonical_url(str(link or ""))
    if u:
        return "u" + hashlib.sha256(u.encode("utf-8")).hexdigest()
    nt = _norm_title(str(title or ""))
    if nt:
        return "t" + hashlib.sha256(nt.encode("utf-8")).hexdigest()
    return "x" + hashlib.sha256(b"empty").hexdigest()


def _clip(s: str, n: int) -> str:
    t = (s or "").strip()
    return t if len(t) <= n else t[: n - 1] + "…"


def _action_suggestion(user_value: float, freshness: float) -> str:
    if user_value >= 72 and freshness >= 60:
        return "现在试用"
    if user_value < 40 and freshness < 35:
        return "可以忽略"
    return "先观望"


def _load_recent_globals(db: Session, *, days: int = 14) -> list[GlobalEvent]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    return list(
        db.execute(
            select(GlobalEvent)
            .where(GlobalEvent.status == "active", GlobalEvent.last_seen_at >= since)
            .order_by(GlobalEvent.last_seen_at.desc())
            .limit(2500)
        )
        .scalars()
        .all()
    )


def _merge_sources_json(existing: str, new_row: dict[str, Any]) -> str:
    try:
        arr = json.loads(existing or "[]")
    except json.JSONDecodeError:
        arr = []
    if not isinstance(arr, list):
        arr = []
    arr.append(new_row)
    # 按 url 去重保留最新
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in reversed(arr):
        u = str(row.get("url") or "")
        if u and u in seen:
            continue
        if u:
            seen.add(u)
        out.append(row)
    out.reverse()
    return json.dumps(out[-30:], ensure_ascii=False)


def merge_raw_into_global(db: Session, ge: GlobalEvent, raw: RawItem) -> None:
    dup = db.execute(
        select(GlobalEventSource.id).where(
            GlobalEventSource.global_event_id == ge.id,
            GlobalEventSource.raw_item_id == raw.id,
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if dup is None:
        db.add(
            GlobalEventSource(
                global_event_id=ge.id,
                raw_item_id=raw.id,
                source_name=str(raw.source or "")[:256],
                source_type=str(raw.source_type or "")[:32],
                url=str(raw.link or "")[:2048],
                published_at=raw.published_at,
            )
        )
    ge.last_seen_at = now
    src_snippet = {
        "source": raw.source,
        "source_type": raw.source_type,
        "url": raw.link,
        "title": raw.title[:300],
    }
    ge.sources_json = _merge_sources_json(ge.sources_json, src_snippet)
    # 代表性标题/链接：偏好更长标题、有效 URL
    if len((raw.title or "").strip()) > len(ge.canonical_title or ""):
        ge.canonical_title = (raw.title or "")[:512]
    if not (ge.canonical_url or "").strip() and (raw.link or "").strip():
        ge.canonical_url = (raw.link or "")[:2048]
    if len((raw.summary or "").strip()) > len(ge.summary or ""):
        ge.summary = (raw.summary or "")[:8000]
    db.flush()


def find_or_create_global_for_raw(db: Session, raw: RawItem) -> GlobalEvent:
    sk = compute_stable_key(raw.link, raw.title)
    ge = db.scalars(select(GlobalEvent).where(GlobalEvent.stable_key == sk)).first()
    if ge:
        merge_raw_into_global(db, ge, raw)
        return ge

    sec = classify_item_section(str(raw.title or ""), str(raw.summary or ""))
    cat = map_global_category(sec, str(raw.source_type or ""))

    rp = raw.published_at
    if rp and rp.tzinfo is None:
        rp = rp.replace(tzinfo=timezone.utc)

    for cand in _load_recent_globals(db):
        if cand.category != cat:
            continue
        if _title_sim(cand.canonical_title, raw.title or "") < TITLE_SIM_THRESHOLD:
            continue
        cp = cand.published_at
        if cp and cp.tzinfo is None:
            cp = cp.replace(tzinfo=timezone.utc)
        if rp and cp:
            dh = abs((rp - cp).total_seconds()) / 3600.0
            if dh <= MERGE_HOURS:
                merge_raw_into_global(db, cand, raw)
                return cand

    sec = classify_item_section(str(raw.title or ""), str(raw.summary or ""))
    cat = map_global_category(sec, str(raw.source_type or ""))
    summary = (raw.summary or "").strip() or (raw.title or "").strip()
    ge = GlobalEvent(
        stable_key=sk,
        canonical_title=(raw.title or "")[:512],
        canonical_url=(raw.link or "")[:2048],
        summary=summary[:8000],
        category=cat,
        source_type=str(raw.source_type or "rss")[:32],
        published_at=raw.published_at,
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        heat_score=int(raw.heat_score or 0),
        sources_json="[]",
        metrics_json="{}",
        capability_tags_json="{}",
        what_happened=_clip(summary, 120),
        why_important=_clip(summary, 200),
        what_it_means_for_you="若与你的场景相关，建议安排短时间跟进官方动态或试用入口。",
        status="active",
    )
    db.add(ge)
    db.flush()
    merge_raw_into_global(db, ge, raw)
    return ge


def recalculate_global_event(db: Session, global_event_id: int) -> None:
    ge = db.get(GlobalEvent, global_event_id)
    if not ge:
        return

    prev = 0.0
    ranking_insight_keep: dict[str, Any] | None = None
    insight_uv: float | None = None
    insight_applied = False
    try:
        m0 = json.loads(ge.metrics_json or "{}")
        if isinstance(m0, dict):
            if m0.get("ranking_score") is not None:
                prev = float(m0.get("ranking_score") or 0)
            ri = m0.get("ranking_insight")
            if isinstance(ri, dict) and ri.get("applied"):
                ranking_insight_keep = ri
                if ri.get("user_value_score") is not None:
                    insight_applied = True
                    insight_uv = float(ri["user_value_score"])
    except Exception:
        prev = 0.0

    rows = db.scalars(
        select(RawItem)
        .join(GlobalEventSource, GlobalEventSource.raw_item_id == RawItem.id)
        .where(GlobalEventSource.global_event_id == ge.id)
    ).all()
    if not rows:
        return

    heats = [int(r.heat_score or 0) for r in rows]
    scores = [int(r.score_total or 0) for r in rows]
    pubs = [r.published_at for r in rows if r.published_at]
    types = [str(r.source_type or "") for r in rows]

    ge.source_count = int(
        db.execute(select(func.count()).select_from(GlobalEventSource).where(GlobalEventSource.global_event_id == ge.id)).scalar()
        or 0
    )
    ge.heat_score = max(heats) if heats else 0
    pub_max = max(pubs) if pubs else ge.published_at
    ge.published_at = pub_max

    dom_type = max(set(types), key=types.count) if types else "rss"
    ge.source_type = dom_type[:32]
    trust = trust_from_source_type(dom_type)
    fresh = freshness_from_published(pub_max)
    heat_n = heat_normalized(ge.heat_score)
    if insight_applied and insight_uv is not None:
        uv = float(max(0.0, min(100.0, insight_uv)))
    else:
        uv = user_value_from_raw_score(max(scores) if scores else 0)
    sc_comp = source_count_component(ge.source_count)

    ge.trust_score = trust
    ge.freshness_score = fresh
    ge.user_value_score = uv
    ge.trend_score = min(100.0, fresh * 0.6 + heat_n * 0.4)

    rk = compute_ranking_score(
        trust_score=trust,
        freshness_score=fresh,
        heat_score_norm=heat_n,
        source_count_score=sc_comp,
        user_value_score=uv,
    )
    ge.ranking_score = rk
    if not insight_applied:
        ge.action_suggestion = _action_suggestion(uv, fresh)

    metrics: dict[str, Any] = {
        "ranking_score": rk,
        "prev_ranking_score": prev,
        "score_breakdown": {
            "trust": round(trust, 2),
            "freshness": round(fresh, 2),
            "heat": round(heat_n, 2),
            "source_mix": round(sc_comp, 2),
            "user_value": round(uv, 2),
        },
    }
    if ranking_insight_keep is not None:
        metrics["ranking_insight"] = ranking_insight_keep
    ge.metrics_json = json.dumps(metrics, ensure_ascii=False)
    db.flush()


def upsert_global_events_from_raw_items(db: Session, raw_item_ids: list[int]) -> list[int]:
    if not raw_item_ids:
        return []
    touched: set[int] = set()
    ids = sorted({int(i) for i in raw_item_ids})
    for rid in ids:
        raw = db.get(RawItem, rid)
        if not raw:
            continue
        ge = find_or_create_global_for_raw(db, raw)
        touched.add(ge.id)
    db.commit()
    for gid in touched:
        try:
            recalculate_global_event(db, gid)
        except Exception as exc:
            _log.exception("recalculate_global_event failed id=%s: %s", gid, exc)
    db.commit()
    return sorted(touched)
