"""
Phase 3.5：周报「判断报告」结构兼容层。
新字段 → 旧字段映射；weekly_quality_v2 审计。
"""

from __future__ import annotations

import json
import re
from typing import Any, Final

# 与 payload_schema.SECTION_* 保持一致（避免循环导入）
SECTION_TITLES: Final[frozenset[str]] = frozenset({"大模型更新", "工具/产品", "行业动态"})
SECTION_ORDER: Final[tuple[str, ...]] = ("大模型更新", "工具/产品", "行业动态")

_ACTION_LEVEL_TO_ATT: Final[dict[str, str]] = {
    "现在试用": "5",
    "先观望": "3",
    "可以忽略": "2",
}

_RECAP_CATEGORY_TO_SECTION: Final[dict[str, str]] = {
    "大模型更新": "大模型更新",
    "工具与产品": "工具/产品",
    "工具/产品": "工具/产品",
    "行业动态": "行业动态",
    "开源项目": "工具/产品",
}

# 术语审计：疑似公司/活动/营销（启发式）
_CORP_LIKE = re.compile(
    r"(Inc\.|Ltd\.|LLC|Corp\.|股份有限公司|科技有限公司|Academy|Conference|Summit|Meetup|Webinar)"
)
_PR_MARKERS = re.compile(
    r"(Register now|Pride Collection|Maintainer Month|Award|Celebrating|Brand campaign)",
    re.I,
)


def _clip(s: str, n: int) -> str:
    t = (s or "").replace("\n", " ").strip()
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def merge_top3_source_urls_judgment_locked(
    j: dict[str, Any],
    lk: dict[str, Any],
    *,
    max_n: int = 8,
) -> list[str]:
    """locked.source_urls + judgment.source_urls 去重合并；顺序以 locked 为主（已含主 URL 在前），再追加 judgment 独有项。"""
    from app.services.top3_selector import materialize_top3_public_fields, normalize_url

    materialize_top3_public_fields(lk)
    locked_su = [str(x).strip() for x in (lk.get("source_urls") or []) if str(x).strip()]
    jud_su = [str(x).strip() for x in (j.get("source_urls") or []) if str(x).strip()]
    primary = str(lk.get("url") or "").strip()

    seq: list[str] = []
    for u in locked_su:
        seq.append(u[:2048])
    if not seq and primary:
        seq.append(primary[:2048])
    for u in jud_su:
        seq.append(u[:2048])

    seen: set[str] = set()
    ordered: list[str] = []
    for u in seq:
        nu = normalize_url(u)
        if not nu or nu in seen:
            continue
        seen.add(nu)
        ordered.append(u[:2048])
    return ordered[:max_n]


def merge_top3_related_strings(
    j: dict[str, Any],
    lk: dict[str, Any],
    field: str,
    *,
    max_n: int = 12,
    cap_len: int = 512,
) -> list[str]:
    """合并 judgment 与 locked 的 id/key 列表：先 locked 再 judgment，去重不覆盖语义。"""
    from app.services.top3_selector import materialize_top3_public_fields

    materialize_top3_public_fields(lk)
    locked_l = lk.get(field) if isinstance(lk.get(field), list) else []
    jud_l = j.get(field) if isinstance(j.get(field), list) else []
    seq: list[str] = []
    for src in (locked_l, jud_l):
        for x in src:
            xs = str(x).strip()
            if xs:
                seq.append(xs[:cap_len])
    seen: set[str] = set()
    ordered: list[str] = []
    for s in seq:
        if s in seen:
            continue
        seen.add(s)
        ordered.append(s)
    return ordered[:max_n]


def resolve_top3_judgment_display_title(j: dict[str, Any], lk: dict[str, Any]) -> str:
    """
    标题优先级：
    1. title_zh / headline_zh
    2. title / headline 且含中文
    3. locked.title 且含中文
    4. locked.title（英文）
    5. source_title / original_title
    """
    from app.services.top3_selector import contains_cjk

    for key in ("title_zh", "headline_zh"):
        v = str(j.get(key) or "").strip()
        if v:
            return v[:200]
    for key in ("title", "headline"):
        v = str(j.get(key) or "").strip()
        if v and contains_cjk(v):
            return v[:200]
    lt = str(lk.get("title") or "").strip()
    if lt and contains_cjk(lt):
        return lt[:200]
    if lt:
        return lt[:200]
    for key in ("source_title", "original_title"):
        v = str(j.get(key) or "").strip()
        if v:
            return v[:200]
    return ""


def apply_locked_top3_merge_judgments(normal: dict[str, Any], locked: list[dict[str, Any]]) -> None:
    """将算法锁定的标题/URL/event 合并进 top3_judgments（保留模型生成的判断正文与中文标题）。"""
    jlist = normal.get("top3_judgments")
    if not isinstance(jlist, list) or not locked:
        return
    for i, lk in enumerate(locked[:3]):
        if i >= len(jlist):
            break
        j = jlist[i]
        if not isinstance(j, dict):
            continue

        title = resolve_top3_judgment_display_title(j, lk)
        if title:
            j["title"] = title[:200]

        j["source_urls"] = merge_top3_source_urls_judgment_locked(j, lk, max_n=8)
        j["related_event_ids"] = merge_top3_related_strings(j, lk, "related_event_ids", max_n=12)
        j["related_stable_keys"] = merge_top3_related_strings(j, lk, "related_stable_keys", max_n=12)


def sync_legacy_top3_from_judgments(normal: dict[str, Any]) -> None:
    """用 top3_judgments 填充 legacy top3 文案字段（URL 已由 apply_locked_top3_merge 锁定）。"""
    jlist = normal.get("top3_judgments")
    top3 = normal.get("top3")
    if not isinstance(jlist, list) or not isinstance(top3, list):
        return
    for i in range(min(3, len(jlist), len(top3))):
        j = jlist[i]
        t = top3[i]
        if not isinstance(j, dict) or not isinstance(t, dict):
            continue
        if str(j.get("title") or "").strip():
            t["title"] = str(j["title"])[:200]
        if str(j.get("what_happened") or "").strip():
            t["what_happened"] = str(j["what_happened"])[:800]
        if str(j.get("why_it_matters") or "").strip():
            t["why_important"] = str(j["why_it_matters"])[:800]
        who = str(j.get("who_should_care") or "").strip()
        wtd = str(j.get("what_to_do_now") or "").strip()
        combo = wtd
        if who:
            combo = f"{wtd}（侧重：{who}）" if wtd else f"侧重：{who}"
        if combo.strip():
            t["what_it_means_for_you"] = _clip(combo, 800)
        al = str(j.get("action_level") or "").strip()
        if al in _ACTION_LEVEL_TO_ATT:
            t["attention_level"] = _ACTION_LEVEL_TO_ATT[al]


def _list_join(lines: Any, sep: str = "；") -> str:
    if isinstance(lines, list):
        return sep.join(_clip(str(x), 200) for x in lines[:6] if str(x).strip())
    return str(lines or "")[:1200]


def map_capability_boundaries_to_capabilities(bounds: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for c in bounds[:5]:
        if not isinstance(c, dict):
            continue
        q = str(c.get("question") or "").strip()
        if not q:
            continue
        can_do = c.get("can_do")
        cannot_do = c.get("cannot_do")
        out.append(
            {
                "theme": q[:200],
                "can_do": _list_join(can_do)[:1200] or str(c.get("conclusion") or "")[:1200],
                "cannot_do": _list_join(cannot_do)[:1200],
                "cost": str(c.get("confidence") or "")[:400],
                "suitable_for": str(c.get("best_for") or "")[:400],
                "conclusion": str(c.get("conclusion") or "")[:500],
            }
        )
    return out


def map_tools_to_try_to_legacy_tools(tools_try: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for t in tools_try[:10]:
        if not isinstance(t, dict):
            continue
        name = str(t.get("name") or "").strip()
        if not name:
            continue
        rec = str(t.get("recommendation") or "").strip()
        worth = "Yes" if rec.startswith("现在") or "试用" in rec[:6] else "No"
        barrier = str(t.get("barrier") or "").strip()
        wiy = str(t.get("recommendation") or "")
        if barrier:
            wiy = f"{wiy}（门槛：{barrier}）" if wiy else f"门槛：{barrier}"
        out.append(
            {
                "name": name[:200],
                "can_do": str(t.get("what_it_does") or "")[:800],
                "suitable_for": str(t.get("best_for") or "")[:400],
                "worth_trying": worth if worth in ("Yes", "No") else "No",
                "what_it_means_for_you": _clip(wiy, 800),
            }
        )
    return out


def map_category_recap_to_sections(recap: list[Any]) -> list[dict[str, Any]]:
    """将 category_recap 转为 PRD v3 sections（三大板块）。"""
    by_cat: dict[str, dict[str, Any]] = {}
    for r in recap:
        if not isinstance(r, dict):
            continue
        raw_cat = str(r.get("category") or "").strip()
        sec_title = _RECAP_CATEGORY_TO_SECTION.get(raw_cat, raw_cat)
        if sec_title not in SECTION_TITLES:
            continue
        evs = r.get("representative_events") or []
        items: list[dict[str, Any]] = []
        if isinstance(evs, list):
            for ev in evs[:4]:
                if isinstance(ev, dict):
                    tit = str(ev.get("title") or ev.get("name") or "").strip()
                    url = str(ev.get("url") or "")
                else:
                    tit = str(ev).strip()
                    url = ""
                if tit:
                    items.append(
                        {
                            "title": tit[:300],
                            "url": url[:2048],
                            "what_happened": _clip(str(r.get("trend") or ""), 400),
                            "suitable_for": "周刊读者",
                            "worth_attention": "Medium",
                            "what_it_means_for_you": str(r.get("what_to_watch") or "")[:800],
                            "see_top3": False,
                        }
                    )
        if not items:
            trend = str(r.get("trend") or "").strip()
            if trend:
                items.append(
                    {
                        "title": "本期趋势",
                        "url": "",
                        "what_happened": trend[:800],
                        "suitable_for": "周刊读者",
                        "worth_attention": "Medium",
                        "what_it_means_for_you": str(r.get("what_to_watch") or "")[:800],
                        "see_top3": False,
                    }
                )
        if items:
            by_cat[sec_title] = {"title": sec_title, "items": items}

    new_secs: list[dict[str, Any]] = []
    for title in SECTION_ORDER:
        if title in by_cat:
            new_secs.append(by_cat[title])
    return new_secs


def map_top3_judgments_to_top3(jlist: list[Any]) -> list[dict[str, str]]:
    """从 judgments 生成 legacy top3 形状（无 URL 时由 locked merge 补全）。"""
    out: list[dict[str, str]] = []
    for j in jlist[:5]:
        if not isinstance(j, dict):
            continue
        title = str(j.get("title") or "").strip()
        if not title:
            continue
        al = str(j.get("action_level") or "").strip()
        att = _ACTION_LEVEL_TO_ATT.get(al, "3")
        su = j.get("source_urls")
        url = ""
        if isinstance(su, list) and su:
            url = str(su[0]).strip()
        out.append(
            {
                "title": title[:200],
                "url": url[:2048],
                "what_happened": str(j.get("what_happened") or "")[:800],
                "why_important": str(j.get("why_it_matters") or "")[:800],
                "what_it_means_for_you": str(j.get("what_to_do_now") or "")[:800],
                "attention_level": att,
            }
        )
    return out


def apply_backward_compat_from_phase35(normal: dict[str, Any]) -> None:
    """
    若存在 Phase 3.5 新字段，则填充对应 legacy 字段（供邮件/旧前端）。
    调用时机：finalize 前，且 top3 已由 locked merge 处理过之后；
    top3 正文也可再次由 sync_legacy_top3_from_judgments 覆盖。
    """
    if not isinstance(normal, dict):
        return

    cb = normal.get("capability_boundaries")
    if isinstance(cb, list) and cb:
        mapped = map_capability_boundaries_to_capabilities(cb)
        if mapped:
            normal["capabilities"] = mapped[:3]

    tt = normal.get("tools_to_try")
    if isinstance(tt, list) and tt:
        mapped_t = map_tools_to_try_to_legacy_tools(tt)
        if mapped_t:
            normal["tools"] = mapped_t[:10]

    cr = normal.get("category_recap")
    if isinstance(cr, list) and cr:
        secs = map_category_recap_to_sections(cr)
        if len(secs) == 3:
            normal["sections"] = secs

    tj = normal.get("top3_judgments")
    if isinstance(tj, list) and tj and not normal.get("top3"):
        normal["top3"] = map_top3_judgments_to_top3(tj)[:3]


def compute_weekly_quality_v2_audit(payload: dict[str, Any]) -> dict[str, Any]:
    """weekly_quality_v2 指标与预警标记。"""
    if not isinstance(payload, dict):
        return {}
    normal = payload.get("normal")
    norm = normal if isinstance(normal, dict) else {}
    gloss = payload.get("glossary") if isinstance(payload.get("glossary"), list) else []

    wt = norm.get("weekly_thesis")
    has_thesis = isinstance(wt, dict) and str(wt.get("headline") or "").strip()

    tj = norm.get("top3_judgments") if isinstance(norm.get("top3_judgments"), list) else []
    top3 = norm.get("top3") if isinstance(norm.get("top3"), list) else []

    cb = norm.get("capability_boundaries") if isinstance(norm.get("capability_boundaries"), list) else []
    caps = norm.get("capabilities") if isinstance(norm.get("capabilities"), list) else []

    tools_try = norm.get("tools_to_try") if isinstance(norm.get("tools_to_try"), list) else []

    noise = norm.get("noise_to_ignore") if isinstance(norm.get("noise_to_ignore"), list) else []

    cr = norm.get("category_recap") if isinstance(norm.get("category_recap"), list) else []

    # conclusion 检查：新结构或旧 capabilities
    caps_have_conclusion = True
    for c in cb[:5]:
        if isinstance(c, dict) and not str(c.get("conclusion") or "").strip():
            caps_have_conclusion = False
            break
    if not cb and caps:
        for c in caps[:3]:
            if isinstance(c, dict) and not str(c.get("conclusion") or "").strip():
                caps_have_conclusion = False
                break

    top3_has_action = True
    for j in tj[:3]:
        if isinstance(j, dict):
            if not str(j.get("what_to_do_now") or "").strip():
                top3_has_action = False
                break
        else:
            top3_has_action = False
            break
    if not tj:
        for t in top3[:3]:
            if isinstance(t, dict) and not str(t.get("what_it_means_for_you") or "").strip():
                top3_has_action = False
                break

    glossary_suspicious = 0
    for g in gloss:
        if not isinstance(g, dict):
            continue
        term = str(g.get("term") or "")
        if _CORP_LIKE.search(term) or _PR_MARKERS.search(term):
            glossary_suspicious += 1

    metrics = {
        "has_weekly_thesis": bool(has_thesis),
        "top3_judgment_count": len(tj) if tj else len(top3),
        "capability_boundary_count": len(cb) if cb else len(caps),
        "tools_to_try_count": len(tools_try),
        "noise_to_ignore_count": len(noise),
        "category_recap_count": len(cr),
        "glossary_count": len(gloss),
        "top3_has_action": top3_has_action,
        "capabilities_have_conclusion": caps_have_conclusion,
        "noise_present": len(noise) >= 2,
        "glossary_suspicious_terms": glossary_suspicious,
    }

    warnings: list[str] = []
    if not has_thesis:
        warnings.append("缺少 weekly_thesis")
    jc = len(tj) if tj else len(top3)
    if jc < 3 and not payload.get("allow_short_top3"):
        warnings.append("Top3 少于 3")
    if not caps_have_conclusion:
        warnings.append("能力边界缺少明确 conclusion")
    if len(noise) < 2:
        warnings.append("noise_to_ignore 少于 2")
    if len(gloss) > 10:
        warnings.append("术语超过 10 条")
    if glossary_suspicious >= 3:
        warnings.append("术语表疑似公司名/活动名过多")

    return {"weekly_quality_v2": metrics, "weekly_quality_v2_warnings": warnings}


def extract_clean_phase35_normal(raw_normal: dict[str, Any] | None) -> dict[str, Any]:
    """从原始 normal 中提取并清洗 Phase 3.5 字段。"""
    if not isinstance(raw_normal, dict):
        return {}
    out: dict[str, Any] = {}

    wt = raw_normal.get("weekly_thesis")
    if isinstance(wt, dict):
        hl = str(wt.get("headline") or "").strip()
        sm = str(wt.get("summary") or "").strip()
        tl = wt.get("trend_lines")
        tls = [str(x).strip() for x in tl][:3] if isinstance(tl, list) else []
        if hl or sm or tls:
            out["weekly_thesis"] = {"headline": hl[:400], "summary": sm[:1200], "trend_lines": tls}

    tj = raw_normal.get("top3_judgments")
    if isinstance(tj, list):
        clean_j: list[dict[str, Any]] = []
        for j in tj:
            if not isinstance(j, dict):
                continue
            tit = str(j.get("title") or "").strip()
            if not tit:
                continue
            rel = j.get("related_event_ids")
            ids = [str(x).strip() for x in rel][:16] if isinstance(rel, list) else []
            rsk = j.get("related_stable_keys")
            rsk_l = [str(x).strip() for x in rsk][:12] if isinstance(rsk, list) else []
            su = j.get("source_urls")
            surl = [str(x).strip() for x in su][:8] if isinstance(su, list) else []
            pulse = j.get("pulse_score")
            try:
                ps = int(pulse) if pulse is not None else 0
            except Exception:
                ps = 0
            clean_j.append(
                {
                    "title": tit[:200],
                    "related_event_ids": ids,
                    "related_stable_keys": rsk_l,
                    "what_happened": str(j.get("what_happened") or "")[:800],
                    "why_it_matters": str(j.get("why_it_matters") or "")[:800],
                    "who_should_care": str(j.get("who_should_care") or "")[:800],
                    "what_to_do_now": str(j.get("what_to_do_now") or "")[:800],
                    "action_level": str(j.get("action_level") or "")[:32],
                    "pulse_score": ps,
                    "source_urls": surl,
                }
            )
        if clean_j:
            out["top3_judgments"] = clean_j[:5]

    cb = raw_normal.get("capability_boundaries")
    if isinstance(cb, list):
        clean_b: list[dict[str, Any]] = []
        for c in cb:
            if not isinstance(c, dict):
                continue
            q = str(c.get("question") or "").strip()
            if not q:
                continue
            cd = c.get("can_do")
            xcd = c.get("cannot_do")
            rel = c.get("related_event_ids")
            clean_b.append(
                {
                    "question": q[:400],
                    "conclusion": str(c.get("conclusion") or "")[:800],
                    "can_do": [str(x)[:400] for x in cd][:3] if isinstance(cd, list) else [],
                    "cannot_do": [str(x)[:400] for x in xcd][:3] if isinstance(xcd, list) else [],
                    "best_for": str(c.get("best_for") or "")[:400],
                    "recommendation": str(c.get("recommendation") or "")[:800],
                    "confidence": str(c.get("confidence") or "")[:16],
                    "related_event_ids": [str(x) for x in rel][:16] if isinstance(rel, list) else [],
                }
            )
        if clean_b:
            out["capability_boundaries"] = clean_b[:5]

    tt = raw_normal.get("tools_to_try")
    if isinstance(tt, list):
        clean_t: list[dict[str, Any]] = []
        for t in tt:
            if not isinstance(t, dict):
                continue
            name = str(t.get("name") or "").strip()
            if not name:
                continue
            rel = t.get("related_event_ids")
            clean_t.append(
                {
                    "name": name[:200],
                    "what_it_does": str(t.get("what_it_does") or "")[:800],
                    "best_for": str(t.get("best_for") or "")[:400],
                    "barrier": str(t.get("barrier") or "")[:16],
                    "recommendation": str(t.get("recommendation") or "")[:64],
                    "related_event_ids": [str(x) for x in rel][:16] if isinstance(rel, list) else [],
                    "url": str(t.get("url") or "")[:2048],
                }
            )
        if clean_t:
            out["tools_to_try"] = clean_t[:10]

    nz = raw_normal.get("noise_to_ignore")
    if isinstance(nz, list):
        clean_n: list[dict[str, Any]] = []
        for n in nz:
            if not isinstance(n, dict):
                continue
            nm = str(n.get("name") or "").strip()
            if not nm:
                continue
            rel = n.get("related_event_ids")
            clean_n.append(
                {
                    "name": nm[:200],
                    "why_not_important": str(n.get("why_not_important") or "")[:800],
                    "recommendation": "可以忽略",
                    "related_event_ids": [str(x) for x in rel][:16] if isinstance(rel, list) else [],
                }
            )
        if clean_n:
            out["noise_to_ignore"] = clean_n[:12]

    cr = raw_normal.get("category_recap")
    if isinstance(cr, list):
        clean_r: list[dict[str, Any]] = []
        for r in cr:
            if not isinstance(r, dict):
                continue
            cat = str(r.get("category") or "").strip()
            if not cat:
                continue
            rev = r.get("representative_events")
            reps: list[str] = []
            if isinstance(rev, list):
                for x in rev[:4]:
                    if isinstance(x, dict):
                        s = str(x.get("title") or x.get("name") or "").strip()
                    else:
                        s = str(x).strip()
                    if s:
                        reps.append(s[:300])
            clean_r.append(
                {
                    "category": cat[:64],
                    "trend": str(r.get("trend") or "")[:800],
                    "representative_events": reps,
                    "what_to_watch": str(r.get("what_to_watch") or "")[:800],
                }
            )
        if clean_r:
            out["category_recap"] = clean_r[:8]

    return out


def weekly_prompt_hard_rules() -> str:
    """所有周报生成 prompt 共用硬规则（中文）。"""
    return (
        "硬规则（必须遵守）：\n"
        "1. 输出中文。\n"
        "2. 不复制英文标题作为正文句子。\n"
        "3. 不输出 HTML 标签。\n"
        "4. 不使用：可能、或许、有望、值得关注、可以参考、可尝试 等空泛词。\n"
        "5. 每个模块都必须包含可执行的行动建议。\n"
        "6. 读者画像：非技术职场人、独立开发者、小团队创业者。\n"
        "7. 帮助用户节省时间，不堆砌资讯。\n"
        "8. 术语表只允许技术/能力概念；不要把公司名、活动名、新闻标题当术语。\n"
        "9. 不值得投入时间的事件明确写「可以忽略」。\n"
        "10. 禁止整份内容沦为事件摘要合集。\n"
    )


def parse_metrics_ranking_insight_applied(metrics_json_str: str | None) -> bool | None:
    """metrics_json.ranking_insight.applied == True"""
    if not metrics_json_str or not str(metrics_json_str).strip():
        return None
    try:
        m = json.loads(metrics_json_str)
    except Exception:
        return None
    ri = m.get("ranking_insight") if isinstance(m, dict) else None
    if not isinstance(ri, dict):
        return None
    return ri.get("applied") is True
