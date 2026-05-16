"""
Phase 3：从 global_events 构造周报 Orchestrator 候选池（候选池 ≠ 最终 Top3）。

时间窗内预排序用于充实候选池；最终三条簇由 top3_selector.select_top3（top3_score + 同簇合并 + 分类上限）决定。
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import GlobalEvent
from app.services.phase35_compat import parse_metrics_ranking_insight_applied
from app.services.ranking_score import effective_ranking_score

_STRONG_KW = (
    "ai",
    "artificial intelligence",
    "llm",
    "agent",
    "agents",
    "generative",
    "model",
    "multimodal",
    "inference",
    "reasoning",
    "openai",
    "anthropic",
    "claude",
    "gemini",
    "deepmind",
    "mistral",
    "hugging face",
    "nvidia",
    "copilot",
    "bedrock",
    "langchain",
    "rag",
    "vector",
    "diffusion",
    "coding assistant",
    "automation",
    "workflow",
)
_WEAK_KW = (
    "cloud",
    "data",
    "developer",
    "github",
    "aws",
    "azure",
    "apple",
    "microsoft",
    "security",
)
_DEMOTE_KW = (
    "pride collection",
    "maintainer month",
    "after hours",
    "register now",
    "webinar",
    "meetup",
    "event",
    "conference",
    "newsletter",
    "roundup",
    "hiring stunt",
    "celebrating",
    "award",
    "brand campaign",
)


def _blob_for_phase35(ge: GlobalEvent) -> str:
    return " ".join(
        [
            ge.canonical_title or "",
            ge.summary or "",
            ge.what_happened or "",
            ge.why_important or "",
        ]
    ).lower()


def _ai_relevance_adjustment(blob: str) -> float:
    t = blob.lower()
    has_strong = any(k in t for k in _STRONG_KW)
    demote_hits = sum(1 for k in _DEMOTE_KW if k in t)
    weak_hits = sum(1 for k in _WEAK_KW if k in t)
    adj = 0.0
    if demote_hits >= 2 and not has_strong:
        adj -= 28.0
    elif demote_hits == 1 and not has_strong:
        adj -= 10.0
    if weak_hits and not has_strong:
        adj -= float(min(10, weak_hits * 2))
    return adj


def _insight_applied_adjustment(metrics_json: str | None) -> float:
    r = parse_metrics_ranking_insight_applied(metrics_json)
    if r is True:
        return 6.0
    if r is False:
        return -1.5
    return 0.0

# 候选池最多拉取条数（防止全表扫描）
_MAX_POOL_FETCH = 1200

# 类别配额（周报忌单一赛道刷屏）
DEFAULT_CATEGORY_CAPS: dict[str, int] = {
    "model": 12,
    "tool": 12,
    "industry": 8,
    "open_source": 8,
    "application": 8,
}


def ge_ts(ge: GlobalEvent) -> datetime:
    t = ge.last_seen_at or ge.published_at or datetime.now(timezone.utc)
    if t.tzinfo is None:
        return t.replace(tzinfo=timezone.utc)
    return t


def _insight_bonus(ge: GlobalEvent) -> float:
    bonus = 0.0
    if (ge.what_happened or "").strip():
        bonus += 3.0
    if (ge.why_important or "").strip():
        bonus += 3.0
    if (ge.what_it_means_for_you or "").strip():
        bonus += 4.0
    if (ge.action_suggestion or "").strip():
        bonus += 2.0
    return bonus


def _sort_score(ge: GlobalEvent, *, now: datetime) -> float:
    """候选池预排序分（不直接等于 Top3 的 top3_score）：effective_ranking_score(..., "7d") + 文案/来源/相关性等。"""
    pub = ge.published_at or ge.last_seen_at
    eff = effective_ranking_score(float(ge.ranking_score or 0.0), pub, "7d", now=now)
    bonus = _insight_bonus(ge)
    sc = min(int(ge.source_count or 1), 20) * 0.25
    blob = _blob_for_phase35(ge)
    rel = _ai_relevance_adjustment(blob)
    ri = _insight_applied_adjustment(ge.metrics_json)
    return float(eff) + bonus + sc + rel + ri


def _insight_coverage_counts(events: list[GlobalEvent]) -> dict[str, int]:
    cov = {"what_happened": 0, "why_important": 0, "what_it_means_for_you": 0, "action_suggestion": 0}
    for ge in events:
        if (ge.what_happened or "").strip():
            cov["what_happened"] += 1
        if (ge.why_important or "").strip():
            cov["why_important"] += 1
        if (ge.what_it_means_for_you or "").strip():
            cov["what_it_means_for_you"] += 1
        if (ge.action_suggestion or "").strip():
            cov["action_suggestion"] += 1
    return cov


def _category_distribution(events: list[GlobalEvent]) -> dict[str, int]:
    dist: dict[str, int] = defaultdict(int)
    for ge in events:
        c = (ge.category or "application").strip() or "application"
        dist[c] += 1
    return dict(dist)


def _cap_for_category(cat: str, caps: dict[str, int]) -> int:
    c = (cat or "").strip() or "application"
    if c in caps:
        return caps[c]
    # 未知类别：与 application 同级上限，避免失控
    return caps.get("application", 8)


def select_with_category_caps(
    sorted_events: list[GlobalEvent],
    *,
    caps: dict[str, int],
    limit: int,
) -> tuple[list[GlobalEvent], bool]:
    """
    先按配额贪心选取；不足 limit 时放宽配额补齐（第二轮无上限）。
    返回 (selected, category_relaxed)。
    """
    counts: dict[str, int] = defaultdict(int)
    selected: list[GlobalEvent] = []
    seen: set[int] = set()

    for ge in sorted_events:
        if len(selected) >= limit:
            break
        cid = int(ge.id)
        if cid in seen:
            continue
        cat = (ge.category or "application").strip() or "application"
        cap = _cap_for_category(cat, caps)
        if counts[cat] < cap:
            selected.append(ge)
            seen.add(cid)
            counts[cat] += 1

    relaxed = False
    if len(selected) < limit:
        relaxed = True
        for ge in sorted_events:
            if len(selected) >= limit:
                break
            cid = int(ge.id)
            if cid in seen:
                continue
            selected.append(ge)
            seen.add(cid)

    return selected, relaxed


def select_global_events_for_weekly(
    db: Session,
    *,
    period_start: date,
    limit: int = 40,
    lookback_days: int = 7,
    min_candidates: int = 8,
    fallback_lookback_days: int = 14,
) -> tuple[list[GlobalEvent], dict[str, Any]]:
    """
    构造周报候选池（不直接输出 Top3）。

    - 来源：过去 lookback_days（默认 7）内 last_seen_at 落在窗内的 active GlobalEvent；不足 min_candidates 时可放宽到 fallback_lookback_days（如 14）。
    - 预排序使用 _sort_score（内含 effective_ranking_score(..., "7d")、文案完整度、来源数、AI 相关性等），再经 select_with_category_caps 做池内类别配额。
    - 该列表供下游组装 EventCards / select_top3；Top3 本身由 top3_score 与簇合并规则决定。
    返回 (events, audit dict)。
    """
    now = datetime.now(timezone.utc)
    caps = dict(DEFAULT_CATEGORY_CAPS)

    def _base_query(cutoff: datetime):
        return select(GlobalEvent).where(
            GlobalEvent.status == "active",
            GlobalEvent.last_seen_at >= cutoff,
            GlobalEvent.canonical_title != "",
            GlobalEvent.canonical_url != "",
            GlobalEvent.ranking_score > 0,
        ).limit(_MAX_POOL_FETCH)

    fallback_used = False
    cutoff = now - timedelta(days=lookback_days)
    rows = list(db.scalars(_base_query(cutoff)).all())

    if (
        len(rows) < min_candidates
        and fallback_lookback_days > lookback_days
    ):
        cutoff_fb = now - timedelta(days=fallback_lookback_days)
        rows = list(db.scalars(_base_query(cutoff_fb)).all())
        fallback_used = True

    scored = [( _sort_score(ge, now=now), ge) for ge in rows]
    scored.sort(key=lambda x: (-x[0], -ge_ts(x[1]).timestamp()))

    sorted_events = [ge for _, ge in scored]

    lim = max(1, min(limit, 200))
    picked, category_relaxed = select_with_category_caps(sorted_events, caps=caps, limit=lim)

    insufficient = len(picked) < min_candidates

    category_distribution = _category_distribution(picked)
    insight_coverage = _insight_coverage_counts(picked)

    report: dict[str, Any] = {
        "weekly_source": "global_events",
        "period_start": period_start.isoformat(),
        "lookback_days": lookback_days if not fallback_used else fallback_lookback_days,
        "fallback_lookback_used": fallback_used,
        "selected_global_event_ids": [int(ge.id) for ge in picked],
        "selected_count": len(picked),
        "category_distribution": category_distribution,
        "insight_coverage": insight_coverage,
        "insufficient_global_events": insufficient,
        "category_relaxed": category_relaxed,
    }
    return picked, report


def global_events_to_orchestrator_dicts(events: list[GlobalEvent]) -> list[dict[str, Any]]:
    """GlobalEvent → orchestrator / summarize 使用的扁 dict（含 _score_total）。"""
    out: list[dict[str, Any]] = []
    for ge in events:
        parts: list[str] = []
        base = (ge.summary or "").strip()
        if base:
            parts.append(base[:400])
        if (ge.what_happened or "").strip():
            parts.append(f"发生了什么：{(ge.what_happened or '').strip()}")
        if (ge.why_important or "").strip():
            parts.append(f"为什么重要：{(ge.why_important or '').strip()}")
        if (ge.what_it_means_for_you or "").strip():
            parts.append(f"对你意味着什么：{(ge.what_it_means_for_you or '').strip()}")
        if (ge.action_suggestion or "").strip():
            parts.append(f"建议：{(ge.action_suggestion or '').strip()}")
        merged = "\n".join(parts).strip()
        if len(merged) > 800:
            merged = merged[:799] + "…"

        st = int(round(float(ge.ranking_score or 0.0)))
        d: dict[str, Any] = {
            "global_event_id": int(ge.id),
            "title": (ge.canonical_title or "").strip(),
            "title_zh": (getattr(ge, "title_zh", None) or "").strip(),
            "summary": merged,
            "link": (ge.canonical_url or "").strip(),
            "url": (ge.canonical_url or "").strip(),
            "_score_total": st,
            "score_total": st,
            "category": ge.category or "",
            "source_count": int(ge.source_count or 0),
        }
        out.append(d)
    return out
