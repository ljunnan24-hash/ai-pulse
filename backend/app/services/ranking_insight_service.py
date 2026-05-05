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

# 入库或兜底文案：视为「尚未真实 enrich」，须优先进入 Insight 候选
_PLACEHOLDER_MARKERS: tuple[str, ...] = (
    "若与你的场景相关",
    "建议安排短时间跟进",
    "该事件仍在分析中",
)


def _text_has_placeholder(text: str | None) -> bool:
    t = text or ""
    return any(m in t for m in _PLACEHOLDER_MARKERS)


def needs_ranking_insight_refresh(ge: GlobalEvent) -> bool:
    """
    是否需要纳入 Ranking Insight（占位文案一律视为未 enrich；
    metrics_json.ranking_insight.applied=true 且无占位则视为已处理）。
    """
    if _text_has_placeholder(ge.what_happened) or _text_has_placeholder(ge.why_important) or _text_has_placeholder(
        ge.what_it_means_for_you
    ):
        return True
    try:
        m = json.loads(ge.metrics_json or "{}")
        ri = m.get("ranking_insight") if isinstance(m, dict) else None
        if isinstance(ri, dict) and ri.get("applied") is True:
            return False
    except Exception:
        pass
    if not (ge.what_happened or "").strip():
        return True
    if not (ge.what_it_means_for_you or "").strip():
        return True
    if not (ge.action_suggestion or "").strip():
        return True
    return False


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


def _priority_needs_insight_ids(db: Session, *, cap: int, scan_limit: int = 4000) -> list[int]:
    """
    占位 / 未 applied / 关键字段为空 — 优先纳入。
    先用 SQL 拉出含占位关键词的行（避免低分占位落在扫描窗口之外），再扫榜补「未 applied」等。
    """
    like_conds: list = []
    for m in _PLACEHOLDER_MARKERS:
        pat = f"%{m}%"
        like_conds.extend(
            [
                GlobalEvent.what_happened.like(pat),
                GlobalEvent.why_important.like(pat),
                GlobalEvent.what_it_means_for_you.like(pat),
            ]
        )
    ph_ids: list[int] = []
    if like_conds:
        ph_ids = list(
            db.scalars(
                select(GlobalEvent.id)
                .where(GlobalEvent.status == "active", or_(*like_conds))
                .order_by(GlobalEvent.ranking_score.desc(), GlobalEvent.heat_score.desc())
                .limit(cap)
            ).all()
        )
    seen: set[int] = set(ph_ids)
    out: list[int] = list(ph_ids)
    if len(out) >= cap:
        return out[:cap]

    rows = db.scalars(
        select(GlobalEvent)
        .where(GlobalEvent.status == "active")
        .order_by(GlobalEvent.ranking_score.desc(), GlobalEvent.heat_score.desc())
        .limit(max(200, min(scan_limit, 8000)))
    ).all()
    for ge in rows:
        if ge.id in seen:
            continue
        if needs_ranking_insight_refresh(ge):
            out.append(ge.id)
            seen.add(ge.id)
            if len(out) >= cap:
                break
    return out


def _collect_candidate_ids(db: Session, *, limit: int, force: bool = False) -> list[int]:
    """
    候选顺序（去重）：
    1. 须刷新 Insight 的事件（含占位文案、未 applied、关键字段空）— **先于** Top30；
    2. 今日有效分 Top30；
    3. ranking_score>=70；
    4. ranking_score>=65 且（字段空 **或** 占位）— 捕获 <70 但仅占位的条目。

    force=True 时：在前述合并后若仍不足 limit，再按分数从高到低补足（用于批量覆盖旧兜底文案）。
    """
    top30 = _today_effective_top_ids(db, 30)
    s70 = list(
        db.scalars(
            select(GlobalEvent.id)
            .where(GlobalEvent.status == "active", GlobalEvent.ranking_score >= 70.0)
            .order_by(GlobalEvent.ranking_score.desc())
        ).all()
    )
    s65_need = list(
        db.scalars(
            select(GlobalEvent.id)
            .where(
                GlobalEvent.status == "active",
                GlobalEvent.ranking_score >= 65.0,
                GlobalEvent.ranking_score < 70.0,
                or_(
                    GlobalEvent.what_happened == "",
                    GlobalEvent.what_it_means_for_you == "",
                    GlobalEvent.action_suggestion == "",
                ),
            )
            .order_by(GlobalEvent.ranking_score.desc())
        ).all()
    )
    priority = _priority_needs_insight_ids(db, cap=limit)

    fill_top_score: list[int] = []
    if force:
        fill_top_score = list(
            db.scalars(
                select(GlobalEvent.id)
                .where(GlobalEvent.status == "active")
                .order_by(GlobalEvent.ranking_score.desc(), GlobalEvent.heat_score.desc())
                .limit(limit * 3)
            ).all()
        )

    out: list[int] = []
    seen: set[int] = set()

    def extend(bucket: list[int]) -> None:
        for gid in bucket:
            if gid in seen:
                continue
            seen.add(gid)
            out.append(gid)
            if len(out) >= limit:
                return

    extend(priority)
    if len(out) >= limit:
        return out[:limit]
    extend(top30)
    if len(out) >= limit:
        return out[:limit]
    extend(s70)
    if len(out) >= limit:
        return out[:limit]
    extend(s65_need)
    if len(out) >= limit:
        return out[:limit]
    if force:
        extend(fill_top_score)
    return out[:limit]


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


def enrich_ranking_insights(db: Session, limit: int | None = None, *, force: bool = False) -> int:
    """
    对候选 global_events 分批调用 LLM，写入判断字段与 capability_tags；
    单批失败仅记录日志；成功批次内逐条 recalculate_global_event 刷新 ranking_score。
    返回成功写入并参与重算的事件数（近似）。

    force=True：忽略 RANKING_INSIGHT_ENABLED；候选不足时用高分事件补足；成功写入后一律
    metrics_json.ranking_insight.applied=true（覆盖旧兜底）。
    """
    settings = get_settings()
    lim = int(limit if limit is not None else settings.ranking_insight_limit)
    lim = max(1, min(lim, 200))
    batch_size = int(settings.ranking_insight_batch_size or 8)
    batch_size = max(4, min(batch_size, 10))

    if not force and not settings.ranking_insight_enabled:
        _log.info("ranking_insight: disabled (RANKING_INSIGHT_ENABLED=false)")
        return 0
    if force and not settings.ranking_insight_enabled:
        _log.warning("ranking_insight: force mode bypasses RANKING_INSIGHT_ENABLED=false")

    client = LlmJsonClient()
    if not client.is_configured():
        _log.info("ranking_insight: skipped (DOUBAO_API_KEY / DOUBAO_MODEL not set)")
        return 0

    ids = _collect_candidate_ids(db, limit=lim, force=force)
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

                if _text_has_placeholder(wh) or _text_has_placeholder(wi) or _text_has_placeholder(wm):
                    _log.warning(
                        "ranking_insight: LLM output still contains placeholder-like copy event_id=%s",
                        ge.id,
                    )

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
                ri_meta: dict[str, Any] = {
                    "applied": True,
                    "user_value_score": uv,
                    "enriched_at": now_iso,
                }
                if force:
                    ri_meta["forced"] = True
                m_prev["ranking_insight"] = ri_meta
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
