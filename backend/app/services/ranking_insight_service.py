"""
Phase 2.5：对高价值 global_events 批量调用 LLM，补齐排行榜/详情判断字段。
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import GlobalEvent
from app.services.llm_json_client import LlmJsonClient
from app.services.ranking_score import effective_ranking_score
from app.services.global_event_service import recalculate_global_event

_log = logging.getLogger("uvicorn.error")

CAPABILITY_KEYS = (
    "reasoning",
    "coding",
    "multimodal",
    "long_context",
    "realtime",
    "safety",
)

ACTION_CHOICES = frozenset({"现在试用", "先观望", "可以忽略"})

_BANNED_SUBSTR = ("可能", "或许", "可尝试", "值得一看")


def _today_effective_top_ids(db: Session, top_n: int) -> list[int]:
    """与公开排行榜 today 范围一致的有效分 Top N（用于 Insight 候选）。"""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=1)
    q = select(GlobalEvent).where(GlobalEvent.status == "active")
    q = q.where(or_(GlobalEvent.published_at >= cutoff, GlobalEvent.last_seen_at >= cutoff))
    rows = db.scalars(q.limit(800)).all()
    scored: list[tuple[float, int]] = []
    for ge in rows:
        eff = effective_ranking_score(float(ge.ranking_score or 0), ge.published_at, "today", now=now)
        scored.append((eff, ge.id))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [x[1] for x in scored[:top_n]]


def _collect_candidate_ids(db: Session, *, limit: int) -> list[int]:
    """
    优先：今日有效分 Top 30 → ranking_score>=70 → 65+ 且任一路径「待补全」判断字段。
    去重后取前 limit 个。
    """
    top30 = _today_effective_top_ids(db, 30)
    s70 = list(
        db.scalars(
            select(GlobalEvent.id)
            .where(GlobalEvent.status == "active", GlobalEvent.ranking_score >= 70.0)
            .order_by(GlobalEvent.ranking_score.desc())
        ).all()
    )
    s65_empty = list(
        db.scalars(
            select(GlobalEvent.id)
            .where(
                GlobalEvent.status == "active",
                GlobalEvent.ranking_score >= 65.0,
                or_(
                    GlobalEvent.what_happened == "",
                    GlobalEvent.what_it_means_for_you == "",
                    GlobalEvent.action_suggestion == "",
                ),
            )
            .order_by(GlobalEvent.ranking_score.desc())
        ).all()
    )
    out: list[int] = []
    seen: set[int] = set()
    for bucket in (top30, s70, s65_empty):
        for gid in bucket:
            if gid in seen:
                continue
            seen.add(gid)
            out.append(gid)
            if len(out) >= limit:
                return out
    return out


def _chunks(xs: list[int], n: int) -> Iterable[list[int]]:
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def _strip_banned(text: str) -> str:
    t = (text or "").strip()
    for b in _BANNED_SUBSTR:
        t = t.replace(b, "")
    return t.strip()


def _normalize_action(v: Any) -> str:
    s = str(v or "").strip()
    if s in ACTION_CHOICES:
        return s
    return "先观望"


def _normalize_capability_tags(raw: Any) -> dict[str, float]:
    out: dict[str, float] = {k: 0.0 for k in CAPABILITY_KEYS}
    if not isinstance(raw, dict):
        return out
    for k in CAPABILITY_KEYS:
        try:
            x = float(raw.get(k, 0.0))
            out[k] = float(max(0.0, min(1.0, x)))
        except (TypeError, ValueError):
            out[k] = 0.0
    return out


def _clip(s: str, max_len: int) -> str:
    t = (s or "").strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def _build_user_payload(ge: GlobalEvent) -> dict[str, Any]:
    try:
        sources = json.loads(ge.sources_json or "[]")
    except json.JSONDecodeError:
        sources = []
    if not isinstance(sources, list):
        sources = []
    slim_sources: list[dict[str, Any]] = []
    for s in sources[:12]:
        if not isinstance(s, dict):
            continue
        slim_sources.append(
            {
                "title": str(s.get("title", ""))[:400],
                "url": str(s.get("url", ""))[:500],
                "source": str(s.get("source", ""))[:120],
            }
        )
    return {
        "event_id": ge.id,
        "title": (ge.canonical_title or "")[:512],
        "summary": (ge.summary or "")[:4000],
        "canonical_url": (ge.canonical_url or "")[:2048],
        "category": ge.category or "",
        "sources_json": slim_sources,
    }


_INSIGHT_SYSTEM = """你是 AI 行业情报编辑，面向非技术职场人与创业者。
你只能根据用户给出的每条事件的 title、summary、canonical_url、sources_json 生成判断；禁止编造事实；不确定时保守表述，但不要使用下方禁用词。
输出必须是单一 JSON 对象，顶层键为 "insights"，值为数组；数组元素格式：
{
  "event_id": <整数>,
  "what_happened": "<=40字，陈述已发生的事实>",
  "why_important": "<=60字，行业层面意义>",
  "what_it_means_for_you": "<=60字，对读者工作/创业的影响>",
  "action_suggestion": "现在试用 | 先观望 | 可以忽略",
  "user_value_score": <0到100的整数>,
  "capability_tags": {
    "reasoning": 0.0,
    "coding": 0.0,
    "multimodal": 0.0,
    "long_context": 0.0,
    "realtime": 0.0,
    "safety": 0.0
  }
}
capability_tags 各值为 0~1。
禁用词（禁止出现在任意字符串字段）：可能、或许、可尝试、值得一看。
action_suggestion 必须是三者之一：现在试用、先观望、可以忽略。
不要 markdown，不要代码围栏。"""


def _parse_insights_response(data: dict[str, Any]) -> list[dict[str, Any]]:
    if not isinstance(data, dict):
        return []
    arr = data.get("insights")
    if not isinstance(arr, list):
        # 兼容扁平 {"items": [...]}
        arr = data.get("items")
    if not isinstance(arr, list):
        return []
    out: list[dict[str, Any]] = []
    for row in arr:
        if isinstance(row, dict) and row.get("event_id") is not None:
            out.append(row)
    return out


def enrich_ranking_insights(db: Session, limit: int | None = None) -> int:
    """
    对候选 global_events 分批调用 LLM，写入判断字段与 capability_tags；
    单批失败仅记录日志；成功批次内逐条 recalculate_global_event 刷新 ranking_score。
    返回成功写入并参与重算的事件数（近似）。
    """
    settings = get_settings()
    lim = int(limit if limit is not None else settings.ranking_insight_limit)
    lim = max(1, min(lim, 200))
    batch_size = int(settings.ranking_insight_batch_size or 8)
    batch_size = max(4, min(batch_size, 10))

    if not settings.ranking_insight_enabled:
        _log.info("ranking_insight: disabled (RANKING_INSIGHT_ENABLED=false)")
        return 0

    client = LlmJsonClient()
    if not client.is_configured():
        _log.info("ranking_insight: skipped (DOUBAO_API_KEY / DOUBAO_MODEL not set)")
        return 0

    ids = _collect_candidate_ids(db, limit=lim)
    if not ids:
        _log.info("ranking_insight: no candidates")
        return 0

    enriched = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for batch in _chunks(ids, batch_size):
        ges = [db.get(GlobalEvent, i) for i in batch]
        ges = [g for g in ges if g and g.status == "active"]
        if not ges:
            continue

        user_lines = [_build_user_payload(g) for g in ges]
        user_prompt = (
            "请为下列事件分别生成 insights 数组元素（insights 长度与事件条数一致，且 event_id 对应）：\n"
            + json.dumps(user_lines, ensure_ascii=False)
        )

        try:
            raw = client.complete_json(
                system=_INSIGHT_SYSTEM,
                user=user_prompt,
                temperature=0.15,
                max_tokens=8192,
                json_retries=2,
            )
        except Exception as exc:
            _log.warning("ranking_insight: LLM batch failed (skipped batch): %s", exc)
            continue

        rows = _parse_insights_response(raw)
        by_id: dict[int, dict[str, Any]] = {}
        for row in rows:
            try:
                eid = int(row.get("event_id"))
                by_id[eid] = row
            except (TypeError, ValueError):
                continue

        batch_updated: list[int] = []
        for ge in ges:
            row = by_id.get(ge.id)
            if not row:
                continue
            try:
                wh = _strip_banned(_clip(str(row.get("what_happened", "")), 40))
                wi = _strip_banned(_clip(str(row.get("why_important", "")), 60))
                wm = _strip_banned(_clip(str(row.get("what_it_means_for_you", "")), 60))
                act = _normalize_action(row.get("action_suggestion"))
                uv_raw = row.get("user_value_score", 50)
                try:
                    uv = float(uv_raw)
                except (TypeError, ValueError):
                    uv = 50.0
                uv = max(0.0, min(100.0, uv))
                caps = _normalize_capability_tags(row.get("capability_tags"))

                if not wh:
                    wh = _clip(ge.canonical_title or "", 40)
                if not wi:
                    wi = _clip(ge.summary or ge.canonical_title or "", 60)
                if not wm:
                    wm = "结合标题与来源核对是否与你业务相关。"

                ge.what_happened = wh[:512]
                ge.why_important = wi[:1024]
                ge.what_it_means_for_you = wm[:1024]
                ge.action_suggestion = act[:32]
                ge.user_value_score = uv
                ge.capability_tags_json = json.dumps(caps, ensure_ascii=False)

                try:
                    m_prev = json.loads(ge.metrics_json or "{}")
                except json.JSONDecodeError:
                    m_prev = {}
                if not isinstance(m_prev, dict):
                    m_prev = {}
                m_prev["ranking_insight"] = {
                    "applied": True,
                    "user_value_score": uv,
                    "enriched_at": now_iso,
                }
                ge.metrics_json = json.dumps(m_prev, ensure_ascii=False)
                batch_updated.append(ge.id)
            except Exception as exc:
                _log.warning("ranking_insight: apply failed event_id=%s: %s", ge.id, exc)
                continue

        if not batch_updated:
            continue

        try:
            db.commit()
        except Exception as exc:
            _log.exception("ranking_insight: commit failed: %s", exc)
            db.rollback()
            continue

        for gid in batch_updated:
            try:
                recalculate_global_event(db, gid)
            except Exception as exc:
                _log.warning("ranking_insight: recalculate failed id=%s: %s", gid, exc)
        try:
            db.commit()
        except Exception as exc:
            _log.exception("ranking_insight: post-recalc commit failed: %s", exc)
            db.rollback()
            continue

        enriched += len(batch_updated)

    _log.info("ranking_insight: enriched ~%s events (limit=%s)", enriched, lim)
    return enriched
