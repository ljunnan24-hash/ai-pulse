"""
确定性 Top3 筛选：重要 + 可信 + 不重复 + 类型分散（不依赖 LLM 选 Top3）。
在 EventCards 之后、Composer 之前调用；Composer 仅润色文案，顺序与 URL 由本模块锁定。
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import parse_qsl, urlparse, urlunparse
from urllib.parse import urlencode as urlencode_query

from app.services.digest_builder import classify_item_section

_SECTION_CN_TO_SLUG = {
    "大模型更新": "model_update",
    "工具/产品": "tool_product",
    "行业动态": "industry",
}

_SOURCE_TRUST_SCORE: dict[str, float] = {
    "official": 92.0,
    "media": 78.0,
    "github": 72.0,
    "community": 58.0,
    "social": 42.0,
    "rss": 68.0,
    "event": 65.0,
}

# Impact Analyst：用户价值（非技术读者）
_AUDIENCE_TYPES = frozenset(
    {"general_user", "founder", "manager", "student", "developer", "enterprise"}
)
_ACTIONABILITY_TYPES = frozenset({"now_try", "watch", "ignore", "not_for_general_user"})

_USER_VALUE_GATE_MIN = 55.0

_TECH_LIB_PAT = re.compile(
    r"(benchmark|基准测试|开源框架|\blibrary\b|\bsdk\b|pytorch|tensorflow|cuda|kernel|npm i\b|pip install|git clone|"
    r"纯技术|论文复现)",
    re.I,
)
_FUNDING_NO_ACTION_PAT = re.compile(r"(融资|亿元|万美元|轮融资|估值|IPO|并购)", re.I)
_USER_VALUE_SIGNAL_PAT = re.compile(
    r"(可试用|免费|注册|下载|App|小程序|网页版|开放体验|立即使用|节省|提效|替代人工|办公|写作|画图|普通用户|无需代码)",
    re.I,
)
_PRODUCT_USER_PAT = re.compile(
    r"(发布|上线|推出|新版|开放注册|ChatGPT|Claude|Gemini|豆包|通义|文心)", re.I,
)


def normalize_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    blocked_params = {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
        "source",
    }
    query = [(k, v) for k, v in parse_qsl(parsed.query) if k.lower() not in blocked_params]
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc.lower(),
            parsed.path.rstrip("/"),
            "",
            urlencode_query(query),
            "",
        )
    )


def title_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def get_num(event: dict[str, Any], key: str, default: float = 0) -> float:
    try:
        return float(event.get(key, default) or default)
    except Exception:
        return default


def _attention_bucket(score_total: float, pool_scores: list[float]) -> str:
    if not pool_scores:
        return "Medium"
    mx = max(pool_scores)
    if mx <= 0:
        return "Medium"
    r = score_total / mx
    if r >= 0.85:
        return "High"
    if r >= 0.5:
        return "Medium"
    return "Low"


def _clamp_user_value(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        v = float(raw)
    except Exception:
        return None
    return max(0.0, min(100.0, v))


def normalize_audience_type(raw: Any) -> str:
    s = str(raw or "").strip().lower()
    return s if s in _AUDIENCE_TYPES else "general_user"


def normalize_actionability(raw: Any) -> str:
    s = str(raw or "").strip().lower()
    return s if s in _ACTIONABILITY_TYPES else "watch"


def estimate_user_value_fallback(event: dict[str, Any]) -> tuple[float, str]:
    """
    Impact Analyst 未给出 user_value_score 时的确定性估算（P0 兜底）。
    区间对齐产品：非技术读者的直接价值。
    """
    blob = " ".join(
        [
            str(event.get("title") or ""),
            str(event.get("one_liner") or ""),
            str(event.get("_text_blob") or ""),
        ]
    )
    st = str(event.get("source_type") or "").lower()

    if _TECH_LIB_PAT.search(blob):
        return 47.0, "规则兜底：偏技术库/基准/框架类，对一般读者直接价值有限。"
    if _PRODUCT_USER_PAT.search(blob) and _USER_VALUE_SIGNAL_PAT.search(blob):
        return 78.0, "规则兜底：产品化或可用性信号强，偏「现在可试」。"
    if _PRODUCT_USER_PAT.search(blob):
        return 74.0, "规则兜底：偏新产品/能力发布，普通用户可关注。"
    if _FUNDING_NO_ACTION_PAT.search(blob) and not _USER_VALUE_SIGNAL_PAT.search(blob):
        return 58.0, "规则兜底：融资/商业叙事为主，缺少明确用户行动点。"
    if _USER_VALUE_SIGNAL_PAT.search(blob):
        return 72.0, "规则兜底：可见提效/试用/替代人工类表述。"
    if st == "github":
        return 50.0, "规则兜底：GitHub 来源默认偏开发者向，保守评分。"
    return 62.0, "规则兜底：缺少 Impact 用户价值字段，中性估计。"


def heat_score_for_top3(event: dict[str, Any]) -> float:
    """GitHub 来源时对 heat 输入封顶，避免 stars 统治排序。"""
    h = get_num(event, "heat_score")
    st = str(event.get("source_type", "")).lower()
    if st == "github":
        return min(h, 55.0)
    return h


def calculate_top3_score_legacy_for_audit(event: dict[str, Any]) -> float:
    """改版前 Top3 综合分（仅对比日志用）：热度/来源权重较高。"""
    base_score = get_num(event, "base_score")
    heat_score = get_num(event, "heat_score")
    freshness_score = get_num(event, "freshness_score")
    source_trust_score = get_num(event, "source_trust_score")
    relevance_score = get_num(event, "relevance_score")
    confidence = get_num(event, "confidence")

    score = (
        base_score * 0.35
        + heat_score * 0.20
        + source_trust_score * 0.20
        + freshness_score * 0.15
        + relevance_score * 0.10
    )

    source_type = str(event.get("source_type", "")).lower()
    attention_level = str(event.get("attention_level", "")).lower()
    fact_status = str(event.get("fact_status", "") or "").lower()

    if confidence >= 0.85:
        score += 8

    if source_type == "official":
        score += 6

    if attention_level == "high":
        score += 5

    if source_type == "social":
        score -= 8

    if confidence < 0.65:
        score -= 20

    if fact_status in ("uncertain", "reject"):
        score -= 50

    return round(score, 2)


def calculate_top3_score(event: dict[str, Any]) -> float:
    """
    Top3 综合分（P0）：用户价值优先，其次基础分与可信源，热度弱化且 GitHub heat 封顶。
    """
    uv = get_num(event, "user_value_score")
    base_score = get_num(event, "base_score")
    source_trust_score = get_num(event, "source_trust_score")
    freshness_score = get_num(event, "freshness_score")
    heat_eff = heat_score_for_top3(event)

    score = (
        uv * 0.45
        + base_score * 0.20
        + source_trust_score * 0.15
        + freshness_score * 0.10
        + heat_eff * 0.10
    )
    return round(score, 2)


def passes_user_value_hard_gates(event: dict[str, Any]) -> bool:
    if get_num(event, "user_value_score") < _USER_VALUE_GATE_MIN:
        return False
    if normalize_actionability(event.get("actionability")) == "not_for_general_user":
        return False
    return True


def is_valid_top3_candidate(event: dict[str, Any]) -> bool:
    confidence = get_num(event, "confidence")
    url = str(event.get("url", "") or "")
    category = str(event.get("category", "") or "")
    fact_status = str(event.get("fact_status", "") or "").lower()

    if not url:
        return False

    if confidence < 0.65:
        return False

    if fact_status in ("uncertain", "reject"):
        return False

    if category not in ("model_update", "tool_product", "industry"):
        return False

    if not passes_user_value_hard_gates(event):
        return False

    return False if event.get("_exclude_top3") else True


def is_duplicate_event(a: dict[str, Any], b: dict[str, Any]) -> bool:
    url_a = normalize_url(str(a.get("url", "")))
    url_b = normalize_url(str(b.get("url", "")))

    if url_a and url_b and url_a == url_b:
        return True

    title_a = str(a.get("title", ""))
    title_b = str(b.get("title", ""))

    if title_similarity(title_a, title_b) >= 0.82:
        return True

    return False


def select_top3(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    for event in events:
        if not is_valid_top3_candidate(event):
            continue
        row = dict(event)
        row["top3_score"] = calculate_top3_score(row)
        candidates.append(row)

    candidates.sort(key=lambda x: float(x.get("top3_score") or 0), reverse=True)

    selected: list[dict[str, Any]] = []
    category_count: dict[str, int] = {}

    for event in candidates:
        cat_key = str(event.get("category") or "")

        if category_count.get(cat_key, 0) >= 2:
            continue

        if any(is_duplicate_event(event, s) for s in selected):
            continue

        selected.append(event)
        category_count[cat_key] = category_count.get(cat_key, 0) + 1

        if len(selected) == 3:
            break

    if len(selected) < 3:
        for event in candidates:
            eid = str(event.get("event_id") or "")
            if any(str(s.get("event_id")) == eid for s in selected):
                continue

            if any(is_duplicate_event(event, s) for s in selected):
                continue

            selected.append(event)

            if len(selected) == 3:
                break

    return selected[:3]


def pool_index_from_event_id(event_id: str | None) -> int | None:
    if not event_id:
        return None
    s = str(event_id).strip()
    if len(s) < 2 or s[0].lower() != "e":
        return None
    try:
        return int(s[1:]) - 1
    except ValueError:
        return None


def _primary_source_type(pool_row: Any) -> str:
    if pool_row is None:
        return "rss"
    sj = getattr(pool_row, "sources_json", None)
    if sj:
        try:
            arr = json.loads(sj)
            if isinstance(arr, list) and arr and isinstance(arr[0], dict):
                st = str(arr[0].get("source_type") or "").strip().lower()
                if st:
                    return st
        except Exception:
            pass
    st = getattr(pool_row, "source_type", None)
    if st:
        return str(st).strip().lower()
    return "rss"


def _freshness_score(pub: datetime | None) -> float:
    if pub is None:
        return 55.0
    try:
        now = datetime.now(timezone.utc)
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        age_days = (now - pub).days
    except Exception:
        return 55.0
    if age_days <= 1:
        return 100.0
    if age_days <= 3:
        return 90.0
    if age_days <= 7:
        return 75.0
    if age_days <= 14:
        return 60.0
    return 45.0


def _verifier_confidence(verifier_row: dict[str, Any] | None) -> float | None:
    if not verifier_row or not isinstance(verifier_row.get("confidence"), dict):
        return None
    lvl = str(verifier_row["confidence"].get("level") or "").lower()
    return {"high": 0.88, "medium": 0.74, "low": 0.58}.get(lvl)


def _parse_card_confidence(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        v = float(raw)
        return v if 0 <= v <= 1 else None
    if isinstance(raw, dict):
        lvl = str(raw.get("level") or "").lower()
        return {"high": 0.88, "medium": 0.74, "low": 0.58}.get(lvl)
    if isinstance(raw, str):
        s = raw.strip().lower()
        if s in ("high", "medium", "low"):
            return _parse_card_confidence({"level": s})
        try:
            v = float(s)
            return v if 0 <= v <= 1 else None
        except ValueError:
            return None
    return None


def _slug_from_issue_event(pool_row: Any) -> str:
    cat_cn = str(getattr(pool_row, "category", "") or "").strip()
    if cat_cn in _SECTION_CN_TO_SLUG:
        return _SECTION_CN_TO_SLUG[cat_cn]
    title = str(getattr(pool_row, "canonical_title", "") or "")
    summary = str(getattr(pool_row, "summary_merged", "") or "")
    mapped = classify_item_section(title, summary)
    return _SECTION_CN_TO_SLUG.get(mapped, "industry")


def _fact_status_from_verifier(verifier_row: dict[str, Any] | None) -> str | None:
    if not verifier_row:
        return None
    conflicts = verifier_row.get("conflicts")
    if isinstance(conflicts, list) and len(conflicts) > 0:
        return "uncertain"
    return None


_OPINION_MARKETING_PAT = re.compile(
    r"(软文|推广稿|PR稿|通稿|个人认为|笔者认为|震惊|标题党)",
    re.I,
)


def build_enriched_event_cards(
    cards_list: list[Any],
    pool: list[Any],
    *,
    verifier: dict[str, Any] | None = None,
    impact: dict[str, Any] | None = None,
    scoring: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    vf_map = _events_by_id(verifier)
    im_map = _events_by_id(impact)
    pool_scores: list[float] = []
    for it in pool:
        try:
            pool_scores.append(float(getattr(it, "score_total", 0) or 0))
        except Exception:
            pool_scores.append(0.0)

    high_noise_ids: set[str] = set()
    if isinstance(scoring, dict):
        for iss in scoring.get("issues") or []:
            if not isinstance(iss, dict):
                continue
            if str(iss.get("severity") or "").lower() != "high":
                continue
            eid = str(iss.get("event_id") or "").strip()
            if eid:
                high_noise_ids.add(eid)

    out: list[dict[str, Any]] = []
    for card in cards_list:
        if not isinstance(card, dict):
            continue
        eid = str(card.get("event_id") or "").strip()
        idx = pool_index_from_event_id(eid)
        pool_row = pool[idx] if idx is not None and 0 <= idx < len(pool) else None

        title = str(card.get("title") or "")
        url = str(card.get("url") or "")
        one_liner = str(card.get("one_liner") or "")
        summary = ""
        if pool_row is not None:
            title = str(getattr(pool_row, "canonical_title", None) or title or "")
            url = str(getattr(pool_row, "canonical_url", None) or url or "")
            summary = str(getattr(pool_row, "summary_merged", "") or "")
        else:
            summary = str(card.get("summary") or "")

        st = _primary_source_type(pool_row)
        if pool_row is not None:
            base_score = float(getattr(pool_row, "score_total", 0) or 0)
            heat_score = float(getattr(pool_row, "heat_score", 0) or 0)
            pub = getattr(pool_row, "published_at", None)
        else:
            try:
                base_score = float(card.get("score") or 0)
            except Exception:
                base_score = 0.0
            heat_score = 0.0
            pub = None

        vf_row = vf_map.get(eid)
        pool_conf = float(getattr(pool_row, "confidence", 0.5) or 0.5) if pool_row else 0.55
        vconf = _verifier_confidence(vf_row)
        cconf = _parse_card_confidence(card.get("confidence"))
        confidence = max(pool_conf, vconf or 0.0, cconf or 0.0)
        if base_score >= 72 and confidence < 0.65:
            confidence = max(confidence, 0.66)

        if pool_row is not None:
            cat_slug = _slug_from_issue_event(pool_row)
        else:
            cat_slug = _SECTION_CN_TO_SLUG.get(classify_item_section(title, summary), "industry")

        fs = str(getattr(pool_row, "fact_status", "") or "").lower() if pool_row else ""
        vfs = _fact_status_from_verifier(vf_row)
        if vfs:
            fs = vfs
        if fs in ("", "unverified"):
            fs = "ok"

        imp_row = im_map.get(eid)
        action = ""
        if isinstance(imp_row, dict):
            action = str(imp_row.get("action") or "").strip()

        _text_blob = re.sub(r"\s+", " ", summary).strip()[:1200] if summary else ""

        uv_reason_imp = ""
        aud_t = "general_user"
        act_b = "watch"
        uv_clamped: float | None = None
        if isinstance(imp_row, dict):
            uv_clamped = _clamp_user_value(imp_row.get("user_value_score"))
            uv_reason_imp = str(imp_row.get("user_value_reason") or "").strip()
            aud_t = normalize_audience_type(imp_row.get("audience_type"))
            act_b = normalize_actionability(imp_row.get("actionability"))

        if uv_clamped is None:
            uv_score_final, fb_reason = estimate_user_value_fallback(
                {
                    "title": title,
                    "one_liner": one_liner,
                    "_text_blob": _text_blob,
                    "source_type": st,
                }
            )
            uv_reason = uv_reason_imp or fb_reason
            user_value_from_impact = False
        else:
            uv_score_final = uv_clamped
            uv_reason = uv_reason_imp or "Impact Analyst 输出。"
            user_value_from_impact = True

        attention_level = _attention_bucket(base_score, pool_scores)

        row: dict[str, Any] = {
            "event_id": eid,
            "title": title,
            "category": cat_slug,
            "source_type": st,
            "confidence": confidence,
            "base_score": base_score,
            "heat_score": heat_score,
            "freshness_score": _freshness_score(pub if isinstance(pub, datetime) else None),
            "source_trust_score": float(_SOURCE_TRUST_SCORE.get(st, 65.0)),
            "relevance_score": min(100.0, max(0.0, base_score * 0.85 + heat_score * 0.15)),
            "attention_level": attention_level,
            "url": url,
            "fact_status": fs,
            "one_liner": one_liner,
            "action": action,
            "user_value_score": uv_score_final,
            "user_value_reason": uv_reason,
            "audience_type": aud_t,
            "actionability": act_b,
            "user_value_from_impact": user_value_from_impact,
            "_text_blob": _text_blob,
        }

        if high_noise_ids and eid in high_noise_ids:
            row["_exclude_top3"] = True

        if title and _OPINION_MARKETING_PAT.search(title + "\n" + summary):
            row["_exclude_top3"] = True

        out.append(row)

    return out


def _events_by_id(pack: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    if not isinstance(pack, dict):
        return out
    for ev in pack.get("events") or []:
        if isinstance(ev, dict) and ev.get("event_id"):
            out[str(ev["event_id"])] = ev
    return out


def compact_for_section_prompt(enriched: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": enriched.get("event_id"),
        "title": enriched.get("title"),
        "url": enriched.get("url"),
        "one_liner": enriched.get("one_liner"),
        "see_top3": False,
    }


def compact_for_top3_prompt(enriched: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_id": enriched.get("event_id"),
        "title": enriched.get("title"),
        "url": enriched.get("url"),
        "category": enriched.get("category"),
        "one_liner": enriched.get("one_liner"),
        "action": enriched.get("action"),
        "top3_score": enriched.get("top3_score"),
        "user_value_score": enriched.get("user_value_score"),
        "actionability": enriched.get("actionability"),
    }


def build_top3_selection_audit(
    enriched_events: list[dict[str, Any]],
    selected: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """供 audit_report_json / 运维排查：每条事件的 Top3 分、用户价值门槛命中情况。"""
    sel_ids = {str(x.get("event_id")) for x in selected if x.get("event_id")}
    out: list[dict[str, Any]] = []
    for ev in enriched_events:
        eid = str(ev.get("event_id") or "")
        raw_score = calculate_top3_score(ev)
        uv = get_num(ev, "user_value_score")
        blocked_uv = uv < _USER_VALUE_GATE_MIN
        blocked_action = normalize_actionability(ev.get("actionability")) == "not_for_general_user"
        excluded_low_user_value = blocked_uv or blocked_action
        reasons: list[str] = []
        if blocked_uv:
            reasons.append("user_value_below_55")
        if blocked_action:
            reasons.append("actionability_not_for_general_user")

        out.append(
            {
                "event_id": eid,
                "top3_score": raw_score,
                "user_value_score": uv,
                "user_value_reason": str(ev.get("user_value_reason") or ""),
                "audience_type": ev.get("audience_type"),
                "actionability": ev.get("actionability"),
                "user_value_from_impact": bool(ev.get("user_value_from_impact")),
                "excluded_low_user_value": excluded_low_user_value,
                "selected_for_top3": eid in sel_ids,
                "low_user_value_gate_notes": reasons,
            }
        )
    return out


def count_candidates_passing_user_value_gate(events: list[dict[str, Any]]) -> int:
    """仅统计通过 user_value 硬门槛（不含置信度/板块等）的候选数，用于 insufficient 判定。"""
    return sum(1 for e in events if passes_user_value_hard_gates(e))


def build_top3_comparison_log(
    enriched_events: list[dict[str, Any]],
    final_top3: list[dict[str, Any]],
    *,
    heat_high_percentile: float = 0.75,
    heat_floor: float = 55.0,
) -> dict[str, Any]:
    """
    P0 验证日志：旧版热度导向排序 vs 用户价值排序 vs 最终 Top3 vs 高热度但被 UV 拦截。
    """
    rows = list(enriched_events)
    legacy_ranked = sorted(
        rows,
        key=lambda e: calculate_top3_score_legacy_for_audit(e),
        reverse=True,
    )[:10]
    old_score_rank_top10 = [
        {
            "rank": i + 1,
            "event_id": str(e.get("event_id") or ""),
            "title": str(e.get("title") or "")[:120],
            "legacy_top3_score": calculate_top3_score_legacy_for_audit(e),
            "heat_score": get_num(e, "heat_score"),
            "source_type": str(e.get("source_type") or ""),
        }
        for i, e in enumerate(legacy_ranked)
    ]

    uv_ranked = sorted(rows, key=lambda e: get_num(e, "user_value_score"), reverse=True)[:10]
    new_user_value_rank_top10 = [
        {
            "rank": i + 1,
            "event_id": str(e.get("event_id") or ""),
            "title": str(e.get("title") or "")[:120],
            "user_value_score": get_num(e, "user_value_score"),
            "new_top3_score": calculate_top3_score(e),
            "actionability": str(e.get("actionability") or ""),
        }
        for i, e in enumerate(uv_ranked)
    ]

    final_top3_summary = [
        {
            "rank": i + 1,
            "event_id": str(x.get("event_id") or ""),
            "title": str(x.get("title") or "")[:120],
            "user_value_score": get_num(x, "user_value_score"),
            "top3_score": calculate_top3_score(x),
        }
        for i, x in enumerate(final_top3[:3])
    ]

    heats_sorted = sorted([get_num(e, "heat_score") for e in rows])
    if heats_sorted:
        idx = min(len(heats_sorted) - 1, int(len(heats_sorted) * heat_high_percentile))
        heat_threshold = max(heat_floor, heats_sorted[idx])
    else:
        heat_threshold = heat_floor

    high_heat_blocked_by_user_value: list[dict[str, Any]] = []
    for e in rows:
        if get_num(e, "heat_score") < heat_threshold:
            continue
        if passes_user_value_hard_gates(e):
            continue
        high_heat_blocked_by_user_value.append(
            {
                "event_id": str(e.get("event_id") or ""),
                "title": str(e.get("title") or "")[:120],
                "heat_score": get_num(e, "heat_score"),
                "user_value_score": get_num(e, "user_value_score"),
                "actionability": str(e.get("actionability") or ""),
                "block_reason": (
                    "actionability_not_for_general_user"
                    if normalize_actionability(e.get("actionability")) == "not_for_general_user"
                    else "user_value_below_55"
                ),
            }
        )

    return {
        "heat_threshold_used": heat_threshold,
        "old_score_rank_top10": old_score_rank_top10,
        "new_user_value_rank_top10": new_user_value_rank_top10,
        "final_top3": final_top3_summary,
        "high_heat_blocked_by_user_value": high_heat_blocked_by_user_value,
        "candidates_passing_user_value_gate_count": count_candidates_passing_user_value_gate(rows),
    }


def attention_level_to_digit(att: str | None) -> str:
    t = (att or "").strip().lower()
    if t == "high":
        return "5"
    if t == "low":
        return "2"
    return "3"


def apply_locked_top3_merge(payload: dict[str, Any], locked: list[dict[str, Any]]) -> None:
    """将算法选定的 Top3 固定到 payload.normal.top3（保留 Composer 已生成的中文段落字段）。"""
    if not isinstance(payload, dict):
        return
    normal = payload.get("normal")
    if not isinstance(normal, dict):
        return
    if not locked:
        normal["top3"] = []
        return
    old_t3 = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    new_t3: list[dict[str, str]] = []
    for i, lk in enumerate(locked[:3]):
        old = old_t3[i] if i < len(old_t3) and isinstance(old_t3[i], dict) else {}
        att = attention_level_to_digit(str(lk.get("attention_level") or ""))
        new_t3.append(
            {
                "title": str(lk.get("title") or old.get("title") or "")[:200],
                "url": str(lk.get("url") or old.get("url") or "")[:2048],
                "what_happened": str(old.get("what_happened") or lk.get("one_liner") or "")[:800],
                "why_important": str(old.get("why_important") or "")[:800],
                "what_it_means_for_you": str(old.get("what_it_means_for_you") or lk.get("action") or "")[:800],
                "attention_level": att,
            }
        )
    if new_t3:
        normal["top3"] = new_t3
