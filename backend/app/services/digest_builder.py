from __future__ import annotations

import html
import json
import re
from typing import Any, Callable

from app.services.payload_schema import SECTION_ORDER, ensure_payload_v3, finalize_payload_v3
from app.services.scoring_service import score_item


def _keywords_lower(keywords: list[str]) -> list[str]:
    return [k.strip().lower() for k in keywords if k.strip()]


def _matches(text: str, kws: list[str]) -> bool:
    tl = text.lower()
    return any(k in tl for k in kws)


def _norm_url(u: str) -> str:
    return (u or "").strip().rstrip("/").lower()


def _clip(s: str, n: int) -> str:
    t = (s or "").replace("\n", " ").strip()
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def _read_item(it: Any) -> tuple[str, str, str, int]:
    if isinstance(it, dict):
        title = str(it.get("title", ""))
        summary = str(it.get("summary", ""))
        link = str(it.get("link", ""))
        try:
            sc = int(it.get("score_total") or 0)
        except Exception:
            sc = 0
        return title, summary, link, sc
    try:
        title = str(getattr(it, "title", "") or "")
        summary = str(getattr(it, "summary", "") or "")
        link = str(getattr(it, "link", "") or "")
        sc = int(getattr(it, "score_total", 0) or 0)
    except Exception:
        title, summary, link, sc = "", "", "", 0
    return title, summary, link, sc


def _collect_text_for_match(obj: Any) -> str:
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, bool):
        return ""
    if isinstance(obj, dict):
        return " ".join(_collect_text_for_match(v) for v in obj.values())
    if isinstance(obj, list):
        return " ".join(_collect_text_for_match(x) for x in obj)
    return str(obj)


def filter_payload_for_keywords(payload: dict[str, Any], keywords: list[str]) -> tuple[dict[str, Any], bool]:
    """若关键词非空，优先保留命中的条目；若过滤后为空则回退全文（matched=False）。"""
    kws = _keywords_lower(keywords)
    if not kws:
        return payload, True

    p = ensure_payload_v3(payload)
    simple = dict(p.get("simple") or {})
    normal = dict(p.get("normal") or {})
    gloss = list(p.get("glossary") or [])

    lines_raw = list(simple.get("lines") or [])
    flines = [ln for ln in lines_raw if isinstance(ln, dict) and _matches(_collect_text_for_match(ln), kws)]
    footer = str(simple.get("footer") or "")
    footer_ok = _matches(footer, kws)

    top3_raw = list(normal.get("top3") or [])
    ftop = [t for t in top3_raw if isinstance(t, dict) and _matches(_collect_text_for_match(t), kws)]

    fsections: list[dict[str, Any]] = []
    for sec in normal.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        title = str(sec.get("title") or "")
        items = sec.get("items") if isinstance(sec.get("items"), list) else []
        fit = [it for it in items if isinstance(it, dict) and _matches(_collect_text_for_match(it), kws)]
        if fit:
            fsections.append({"title": title, "items": fit})

    fcaps = [
        c
        for c in (normal.get("capabilities") or [])
        if isinstance(c, dict) and _matches(_collect_text_for_match(c), kws)
    ]
    ftools = [
        t
        for t in (normal.get("tools") or [])
        if isinstance(t, dict) and _matches(_collect_text_for_match(t), kws)
    ]
    fgloss = [g for g in gloss if isinstance(g, dict) and _matches(_collect_text_for_match(g), kws)]

    has_any = bool(
        flines or ftop or fsections or fcaps or ftools or fgloss or (footer_ok and footer)
    )
    if not has_any:
        return payload, False

    out: dict[str, Any] = {
        "simple": {
            "lines": flines if flines else lines_raw,
            "footer": footer if (footer_ok or not flines) else footer,
        },
        "normal": {
            "top3": ftop if ftop else top3_raw,
            "sections": fsections if fsections else normal.get("sections", []),
            "capabilities": fcaps if fcaps else (normal.get("capabilities") or []),
            "tools": ftools if ftools else (normal.get("tools") or []),
        },
        "glossary": fgloss if fgloss else gloss,
    }
    return ensure_payload_v3(out), True


def _keyword_match_count(text: str, kws: list[str]) -> int:
    tl = (text or "").lower()
    hits = 0
    for k in kws:
        if k and k in tl:
            hits += 1
    return hits


def _keyword_bonus(hit_count: int) -> int:
    if hit_count <= 0:
        return 0
    if hit_count == 1:
        return 4
    if hit_count == 2:
        return 7
    return 9


def _item_base_score(it: Any) -> int:
    for key in ("score_total", "_score_total"):
        try:
            v = getattr(it, key)
        except Exception:
            v = it.get(key) if isinstance(it, dict) else None
        if v is not None:
            try:
                return int(v)
            except Exception:
                pass

    if isinstance(it, dict):
        return int(score_item(it).total)
    try:
        d = {
            "source_type": getattr(it, "source_type", "rss"),
            "title": getattr(it, "title", ""),
            "summary": getattr(it, "summary", ""),
            "heat_score": getattr(it, "heat_score", 0),
        }
        return int(score_item(d).total)
    except Exception:
        return 0


def select_top_items(
    raw_items: list[Any],
    *,
    keywords: list[str] | None,
    top_n: int,
) -> tuple[list[Any], bool]:
    kws = _keywords_lower(keywords or [])
    if top_n <= 0:
        return [], True

    enriched: list[tuple[Any, int, int, int]] = []
    for it in raw_items:
        title, summary, link, _ = _read_item(it)
        base = _item_base_score(it)
        hit_count = _keyword_match_count(f"{title}\n{summary}\n{link}", kws) if kws else 0
        bonus = _keyword_bonus(hit_count)
        adjusted = min(100, base + min(bonus, 10))
        enriched.append((it, int(adjusted), int(base), int(hit_count)))

    if not kws:
        enriched.sort(key=lambda x: (x[2], x[1]), reverse=True)
        return [x[0] for x in enriched[:top_n]], True

    matched = [x for x in enriched if x[3] > 0]
    rest = [x for x in enriched if x[3] <= 0]
    matched_any = bool(matched)

    matched.sort(key=lambda x: (x[1], x[2]), reverse=True)
    rest.sort(key=lambda x: (x[2], x[1]), reverse=True)

    out: list[Any] = [x[0] for x in matched[:top_n]]
    if len(out) < top_n:
        need = top_n - len(out)
        out.extend([x[0] for x in rest[:need]])
    return out, matched_any


def classify_item_section(title: str, summary: str) -> str:
    t = (title + "\n" + summary).lower()
    if any(
        k in t
        for k in [
            "gpt",
            "gemini",
            "claude",
            "llama",
            "模型",
            "reason",
            "推理",
            "multimodal",
            "多模态",
        ]
    ):
        return "大模型更新"
    if any(
        k in t
        for k in [
            "tool",
            "产品",
            "应用",
            "助手",
            "agent",
            "copilot",
            "平台",
            "发布",
            "上线",
            "api",
        ]
    ):
        return "工具/产品"
    return "行业动态"


def _worth_from_rank(rank: int, pool_scores: list[int]) -> str:
    if not pool_scores:
        return "Medium"
    n = len(pool_scores)
    third = max(1, n // 3)
    if rank < third:
        return "High"
    if rank < 2 * third:
        return "Medium"
    return "Low"


def _attention_for_top_index(i: int) -> str:
    return str(5 - min(i, 4))


def _default_glossary() -> list[dict[str, str]]:
    return [
        {
            "term": "大模型",
            "explain": "用海量数据训练、可处理多种任务的通用模型，多通过对话或 API 使用。",
        },
        {
            "term": "多模态",
            "explain": "同时理解文本、图片、音频等多种输入形式的能力。",
        },
        {
            "term": "Agent",
            "explain": "能自动规划步骤并调用工具完成任务的智能体，而非只会聊天。",
        },
        {
            "term": "RAG",
            "explain": "检索相关文档再生成回答，提升专业领域回答的可追溯性。",
        },
        {
            "term": "提示词",
            "explain": "你告诉模型的任务描述与约束，会明显影响输出质量与风格。",
        },
    ]


def _means_placeholder(i: int) -> str:
    phrases = [
        "若与你本周的重点方向相关，建议安排 15 分钟跟进并试用官方入口。",
        "对关注效率与自动化的人，此事可能成为本周最值得跟进的一条线索。",
        "不必深挖技术细节，先判断它是否覆盖你的场景与预算。",
        "如果你在评估供应商或工具栈，把它当作背景信号纳入对比清单。",
        "可作为团队分享的谈资：用一句话讲清「对你有什么用」。",
    ]
    return phrases[i % len(phrases)]


def _why_placeholder() -> str:
    return "本周在媒体与社区声量较高，且可能改变后续产品路线与采购决策。"


def _simple_lines_from_items(selected: list[Any]) -> list[dict[str, str]]:
    lines: list[dict[str, str]] = []
    for i, it in enumerate(selected):
        title, summary, link, _ = _read_item(it)
        title = (title or "").strip()
        link = (link or "").strip()
        if not title and link:
            title = link
        fact_src = re.sub(r"\s+", " ", summary).strip() or title
        lines.append(
            {
                "title": title[:300],
                "what_happened": _clip(fact_src, 30),
                "what_it_means_for_you": _means_placeholder(i),
                "url": link[:2048],
            }
        )
    while len(lines) < 3:
        lines.append(
            {
                "title": "本期条目仍在补充",
                "what_happened": "有效来源不足，下期会继续汇总。",
                "what_it_means_for_you": "先把本周已知信号消化完，再追新更省力。",
                "url": "",
            }
        )
    return lines[:5]


def _build_capability_block(pool: list[Any]) -> list[dict[str, str]]:
    if not pool:
        return []
    it = pool[0]
    title, summary, _, _ = _read_item(it)
    theme = _clip(f"围绕「{title}」，普通人能否直接受益？", 80)
    summary = re.sub(r"\s+", " ", summary).strip()
    return [
        {
            "theme": theme,
            "can_do": _clip(summary or title, 400) or "可将重复性文字工作交给模型草稿化，再由你校对定稿。",
            "cannot_do": "在强合规、强一致场景仍需要你人工核对关键结论与引用来源。",
            "cost": "多数服务可按量付费；免费档通常有速率或字数限额。",
            "suitable_for": "希望用 AI 提效、但不打算啃论文的非技术岗位用户。",
            "conclusion": "建议先从小任务试用，再决定是否扩大使用范围。",
        }
    ]


def _build_tool_rows(bucket: list[Any], top3_urls: set[str], limit: int = 3) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for it in bucket:
        title, summary, link, _ = _read_item(it)
        if _norm_url(link) in top3_urls:
            continue
        worth = "Yes" if len(out) == 0 else "Yes" if any(k in (title + summary).lower() for k in ["free", "免费", "试用"]) else "No"
        out.append(
            {
                "name": _clip(title, 120),
                "can_do": _clip(summary, 300) or "用于信息整理、文案草稿与常见问答场景的加速。",
                "suitable_for": "需要快速验证工作流是否匹配的业务同学。",
                "worth_trying": worth,
                "what_it_means_for_you": "你可把它当作本周的「低成本试错」选项，小任务跑通再扩大。",
            }
        )
        if len(out) >= limit:
            break
    return out


def build_payload_from_raw_items(
    raw_items: list[Any],
    *,
    mode: str,
    keywords: list[str] | None = None,
) -> tuple[dict[str, Any], bool]:
    """
    从 RawItem 生成 PRD v3 结构化 payload（确定性占位文案 + 可替换为 LLM 润色）。
    """
    simple_n = 5
    normal_top3_n = 3
    normal_pool_n = 12

    if mode == "simple":
        selected, matched_any = select_top_items(raw_items, keywords=keywords, top_n=simple_n)
        lines = _simple_lines_from_items(selected)[:simple_n]
        payload: dict[str, Any] = {
            "simple": {"lines": lines[:simple_n], "footer": ""},
            "normal": {},
            "glossary": [],
        }
        return finalize_payload_v3(payload), matched_any

    pool, matched_any = select_top_items(raw_items, keywords=keywords, top_n=normal_pool_n)
    sel_simple, _ = select_top_items(raw_items, keywords=keywords, top_n=simple_n)
    simple_lines_full = _simple_lines_from_items(sel_simple)
    top3 = pool[:normal_top3_n]
    top3_urls = {_norm_url(_read_item(it)[2]) for it in top3 if _norm_url(_read_item(it)[2])}
    pool_scores = [_item_base_score(x) for x in pool]
    pool_scores.sort(reverse=True)

    top3_payload: list[dict[str, str]] = []
    for i, it in enumerate(top3):
        title, summary, link, _ = _read_item(it)
        title = (str(title) or "").strip()
        link = (str(link) or "").strip()
        if not title:
            continue
        summary = re.sub(r"\s+", " ", summary).strip()
        top3_payload.append(
            {
                "title": str(title)[:200],
                "url": str(link)[:2048],
                "what_happened": _clip(summary or title, 260),
                "why_important": _why_placeholder(),
                "what_it_means_for_you": _means_placeholder(i + 2),
                "attention_level": _attention_for_top_index(i),
            }
        )

    buckets: dict[str, list[Any]] = {"大模型更新": [], "工具/产品": [], "行业动态": []}
    rank_map: dict[str, int] = {}
    for idx, it in enumerate(pool):
        title, summary, link, _ = _read_item(it)
        sec = classify_item_section(str(title), str(summary))
        buckets[sec].append(it)
        nu = _norm_url(link)
        if nu:
            rank_map[nu] = idx

    sections: list[dict[str, Any]] = []
    for sec_title in SECTION_ORDER:
        items_raw = list(buckets.get(sec_title) or [])
        section_items: list[dict[str, Any]] = []
        for it in items_raw[:8]:
            title, summary, link, _ = _read_item(it)
            title = (str(title) or "").strip()
            summary = re.sub(r"\s+", " ", str(summary) or "").strip()
            link = str(link or "").strip()
            if not title:
                continue
            nu = _norm_url(link)
            in_top = nu in top3_urls if nu else False
            rk = rank_map.get(nu, 999)
            worth = _worth_from_rank(rk, pool_scores)
            if in_top:
                section_items.append(
                    {
                        "title": title[:300],
                        "url": link[:2048],
                        "what_happened": _clip(summary or title, 320),
                        "suitable_for": "（决策见 Top3）",
                        "worth_attention": worth,
                        "what_it_means_for_you": "",
                        "see_top3": True,
                    }
                )
            else:
                section_items.append(
                    {
                        "title": title[:300],
                        "url": link[:2048],
                        "what_happened": _clip(summary or title, 320),
                        "suitable_for": "关注此类信息的职场用户与管理者",
                        "worth_attention": worth,
                        "what_it_means_for_you": _means_placeholder(rank_map.get(nu, 0)),
                        "see_top3": False,
                    }
                )
        if not section_items:
            section_items.append(
                {
                    "title": "本周该分类暂无强信号",
                    "url": "",
                    "what_happened": "本周期收录到的条目较少或置信度有限，未单独展开。",
                    "suitable_for": "持续关注的读者",
                    "worth_attention": "Low",
                    "what_it_means_for_you": "可跳过，等待下期更新。",
                    "see_top3": False,
                }
            )
        sections.append({"title": sec_title, "items": section_items})

    capabilities = _build_capability_block(pool)
    tool_bucket = buckets.get("工具/产品") or []
    tools = _build_tool_rows(tool_bucket, top3_urls, limit=3)

    while len(top3_payload) < 3:
        top3_payload.append(
            {
                "title": "本期可跟进条目较少或仍在核实",
                "url": "",
                "what_happened": "本周有效来源有限，先把现有信号看清楚再行动更稳妥。",
                "why_important": "信息稀缺时，噪声更容易被放大；谨慎比误读更可取。",
                "what_it_means_for_you": "你可以把精力放回既定目标，不必强行制造跟进动作。",
                "attention_level": "2",
            }
        )

    payload = {
        "simple": {"lines": simple_lines_full, "footer": ""},
        "normal": {
            "top3": top3_payload[:3],
            "sections": sections,
            "capabilities": capabilities,
            "tools": tools,
        },
        "glossary": _default_glossary(),
    }
    return finalize_payload_v3(payload), matched_any


def _stars_html(level: str) -> str:
    try:
        n = int(str(level).strip())
    except Exception:
        n = 3
    n = max(1, min(5, n))
    return "⭐" * n


def render_issue_email(
    payload: dict[str, Any],
    mode: str,
    *,
    keyword_banner: str | None = None,
    recipient_email: str | None = None,
    issue_heading: str | None = None,
    top3_link_wrap: Callable[[str, int], str] | None = None,
) -> tuple[str, str]:
    """返回 (html, plain_text)；payload 建议先经 ensure_payload_v3。
    issue_heading：PRD 固定标题行，如「AI Pulse 周报 · 2026年第19周」。
    top3_link_wrap：可选，将 Top3 外链替换为追踪跳转 URL（第二个参数为 0-based 序号）。
    """
    p = ensure_payload_v3(payload)
    s = p.get("simple") or {}
    n = p.get("normal") or {}
    glossary = p.get("glossary") or []

    parts_html: list[str] = []
    parts_txt: list[str] = []

    if recipient_email:
        parts_html.append(
            f'<p style="color:#666;font-size:13px">本邮件发送至：<b>{html.escape(recipient_email)}</b></p>'
        )
        parts_txt.append(f"本邮件发送至：{recipient_email}")

    if keyword_banner:
        parts_html.append(f'<p style="color:#555;font-size:14px">{html.escape(keyword_banner)}</p>')
        parts_txt.append(keyword_banner)

    if issue_heading and str(issue_heading).strip():
        main_h_plain = str(issue_heading).strip()
        main_h_html = html.escape(main_h_plain)
    else:
        main_h_plain = "AI Pulse 周报"
        main_h_html = html.escape(main_h_plain)

    if mode == "simple":
        parts_html.append(f"<h2 style='margin-bottom:4px'>{main_h_html}</h2>")
        parts_html.append(
            "<p style='margin:0 0 12px;font-size:13px;color:#666'>Simple · 约 30 秒读完本周要点</p>"
        )
        parts_html.append("<h3 style='margin-top:0'>🔥 本周最重要的 AI 事</h3><ol>")
        for ln in s.get("lines", []):
            if isinstance(ln, dict):
                tit = html.escape(str(ln.get("title", "")))
                wh = html.escape(str(ln.get("what_happened", "")))
                wm = html.escape(str(ln.get("what_it_means_for_you", "")))
                url = str(ln.get("url", "")).strip()
                parts_html.append("<li style='margin-bottom:12px'>")
                parts_html.append(f"<div><strong>{tit}</strong></div>")
                parts_html.append(f"<div>👉 发生了什么：{wh}</div>")
                parts_html.append(f"<div>👉 对你意味着什么：{wm}</div>")
                if url:
                    parts_html.append(
                        f'<div>🔗 <a href="{html.escape(url, quote=True)}">{html.escape(url)}</a></div>'
                    )
                parts_html.append("</li>")
            else:
                parts_html.append(f"<li>{html.escape(str(ln))}</li>")
        parts_html.append("</ol>")
        if s.get("footer"):
            parts_html.append(f"<p><strong>小结：</strong>{html.escape(str(s['footer']))}</p>")

        parts_txt.append(main_h_plain + " · Simple")
        parts_txt.append("本周最重要的 AI 事：")
        for ln in s.get("lines", []):
            if isinstance(ln, dict):
                t = str(ln.get("title", ""))
                parts_txt.append(
                    f"- {t}\n  发生了什么：{ln.get('what_happened','')}\n  对你意味着什么：{ln.get('what_it_means_for_you','')}\n  链接：{ln.get('url','')}"
                )
            else:
                parts_txt.append(f"- {ln}")
        if s.get("footer"):
            parts_txt.append(f"小结：{s['footer']}")
    else:
        parts_html.append(f"<h2 style='margin-bottom:4px'>{main_h_html}</h2>")
        parts_html.append(
            "<p style='margin:0 0 12px;font-size:13px;color:#666'>Normal · Top3 / 分类 / 能力 / 工具 · 决策参考</p>"
        )
        parts_txt.append(main_h_plain + " · Normal")

        top3 = n.get("top3") or []
        if top3:
            top3_heading = str(n.get("top3_section_title") or "").strip() or "Top3 关键事件"
            parts_html.append(f"<h3>{html.escape(top3_heading)}</h3>")
            parts_txt.append(top3_heading)
            for idx, t in enumerate(top3):
                if not isinstance(t, dict):
                    continue
                tit = html.escape(str(t.get("title", "")))
                url = str(t.get("url", "")).strip()
                parts_html.append("<div style='margin-bottom:16px;border-bottom:1px solid #eee;padding-bottom:12px'>")
                parts_html.append(f"<div style='font-size:18px;font-weight:700'>{tit}</div>")
                parts_html.append(f"<p><strong>发生了什么：</strong>{html.escape(str(t.get('what_happened','')))}</p>")
                parts_html.append(f"<p><strong>为什么重要：</strong>{html.escape(str(t.get('why_important','')))}</p>")
                parts_html.append(
                    f"<p><strong>👉 对你意味着什么：</strong>{html.escape(str(t.get('what_it_means_for_you','')))}</p>"
                )
                parts_html.append(
                    f"<p><strong>关注程度：</strong>{_stars_html(str(t.get('attention_level','3')))}</p>"
                )
                if url:
                    href_url = top3_link_wrap(url, idx) if top3_link_wrap else url
                    parts_html.append(
                        f'<p>🔗 <a href="{html.escape(href_url, quote=True)}">{html.escape(url)}</a></p>'
                    )
                parts_html.append("</div>")

                tx = "\n".join(
                    [
                        str(t.get("title", "")),
                        f"发生了什么：{t.get('what_happened','')}",
                        f"为什么重要：{t.get('why_important','')}",
                        f"对你意味着什么：{t.get('what_it_means_for_you','')}",
                        f"关注程度：{_stars_html(str(t.get('attention_level','3')))}（{t.get('attention_level','')}）",
                        f"链接：{url}" if url else "",
                    ]
                )
                parts_txt.append(tx)

        secs = n.get("sections") or []
        if secs:
            parts_html.append("<h3>分类事件流</h3>")
            parts_txt.append("分类事件流")
            for sec in secs:
                if not isinstance(sec, dict):
                    continue
                st = html.escape(str(sec.get("title", "")))
                parts_html.append(f"<h4 style='margin:16px 0 8px;color:#444'>{st}</h4>")
                parts_txt.append(sec.get("title", "") or "")
                for it in sec.get("items") or []:
                    if not isinstance(it, dict):
                        continue
                    tit = html.escape(str(it.get("title", "")))
                    mark = "（见 Top3）" if it.get("see_top3") else ""
                    parts_html.append("<div style='margin-bottom:12px'>")
                    parts_html.append(f"<div><strong>{tit}</strong>{html.escape(mark)}</div>")
                    parts_html.append(f"<div>发生了什么：{html.escape(str(it.get('what_happened','')))}</div>")
                    parts_html.append(f"<div>适合谁：{html.escape(str(it.get('suitable_for','')))}</div>")
                    parts_html.append(
                        f"<div>👉 是否值得关注：<strong>{html.escape(str(it.get('worth_attention','')))}</strong></div>"
                    )
                    if str(it.get("what_it_means_for_you") or "").strip():
                        parts_html.append(
                            f"<div>👉 对你意味着什么：{html.escape(str(it.get('what_it_means_for_you','')))}</div>"
                        )
                    u = str(it.get("url", "")).strip()
                    if u:
                        parts_html.append(f'<div>🔗 <a href="{html.escape(u, quote=True)}">{html.escape(u)}</a></div>')
                    parts_html.append("</div>")

                    tlines = [
                        str(it.get("title", "")) + mark,
                        f"发生了什么：{it.get('what_happened','')}",
                        f"适合谁：{it.get('suitable_for','')}",
                        f"是否值得关注：{it.get('worth_attention','')}",
                    ]
                    if str(it.get("what_it_means_for_you") or "").strip():
                        tlines.append(f"对你意味着什么：{it.get('what_it_means_for_you','')}")
                    if u:
                        tlines.append(f"链接：{u}")
                    parts_txt.append("\n".join(tlines))

        caps = n.get("capabilities") or []
        if caps:
            parts_html.append("<h3>AI 能力进展</h3>")
            parts_txt.append("AI 能力进展")
            for c in caps:
                if not isinstance(c, dict):
                    continue
                parts_html.append("<div style='margin-bottom:14px'>")
                parts_html.append(
                    f"<p><strong>主题：</strong>{html.escape(str(c.get('theme','')))}</p>"
                )
                parts_html.append(f"<p><strong>当前能做到：</strong>{html.escape(str(c.get('can_do','')))}</p>")
                parts_html.append(f"<p><strong>还做不到：</strong>{html.escape(str(c.get('cannot_do','')))}</p>")
                parts_html.append(f"<p><strong>成本：</strong>{html.escape(str(c.get('cost','')))}</p>")
                parts_html.append(f"<p><strong>适合谁：</strong>{html.escape(str(c.get('suitable_for','')))}</p>")
                parts_html.append(
                    f"<p><strong>👉 结论：</strong>{html.escape(str(c.get('conclusion','')))}</p>"
                )
                parts_html.append("</div>")
                parts_txt.append(
                    "\n".join(
                        [
                            f"主题：{c.get('theme','')}",
                            f"当前能做到：{c.get('can_do','')}",
                            f"还做不到：{c.get('cannot_do','')}",
                            f"成本：{c.get('cost','')}",
                            f"适合谁：{c.get('suitable_for','')}",
                            f"结论：{c.get('conclusion','')}",
                        ]
                    )
                )

        tools = n.get("tools") or []
        if tools:
            parts_html.append("<h3>本周工具观察</h3>")
            parts_txt.append("本周工具观察")
            for tool in tools:
                if not isinstance(tool, dict):
                    continue
                parts_html.append("<div style='margin-bottom:12px'>")
                parts_html.append(f"<div style='font-weight:700'>{html.escape(str(tool.get('name','')))}</div>")
                parts_html.append(f"<div>能做什么：{html.escape(str(tool.get('can_do','')))}</div>")
                parts_html.append(f"<div>适合谁：{html.escape(str(tool.get('suitable_for','')))}</div>")
                parts_html.append(
                    f"<div>👉 是否值得试：<strong>{html.escape(str(tool.get('worth_trying','')))}</strong></div>"
                )
                parts_html.append(
                    f"<div>👉 对你意味着什么：{html.escape(str(tool.get('what_it_means_for_you','')))}</div>"
                )
                parts_html.append("</div>")
                parts_txt.append(
                    "\n".join(
                        [
                            str(tool.get("name", "")),
                            f"能做什么：{tool.get('can_do','')}",
                            f"适合谁：{tool.get('suitable_for','')}",
                            f"是否值得试：{tool.get('worth_trying','')}",
                            f"对你意味着什么：{tool.get('what_it_means_for_you','')}",
                        ]
                    )
                )

    if glossary:
        parts_html.append("<h3>术语表</h3>")
        parts_html.append("<table border='0' cellpadding='6' style='border-collapse:collapse'>")
        parts_html.append("<tr><th align='left'>术语</th><th align='left'>解释</th></tr>")
        for g in glossary:
            if not isinstance(g, dict):
                continue
            term = html.escape(str(g.get("term", "")))
            expl = html.escape(str(g.get("explain", "")))
            parts_html.append(f"<tr><td>{term}</td><td>{expl}</td></tr>")
        parts_html.append("</table>")
        parts_txt.append("术语表")
        for g in glossary:
            if isinstance(g, dict):
                parts_txt.append(f"- {g.get('term')}: {g.get('explain')}")

    html_body = (
        "<html><body style='font-family:system-ui,sans-serif;max-width:640px;line-height:1.5'>" + "\n".join(parts_html) + "</body></html>"
    )
    text_body = "\n\n".join(parts_txt)
    return html_body, text_body


def render_weekly_public_page(
    payload: dict[str, Any],
    *,
    page_heading: str | None = None,
    top3_link_wrap: Callable[[str, int], str] | None = None,
) -> str:
    """
    浏览器可读的完整周报 HTML（数据来源 payload_json / PRD v3），与邮件正文无关。
    """
    p = ensure_payload_v3(payload)
    heading = (page_heading or "").strip() or "AI Pulse 周报"
    html_body, _text = render_issue_email(
        p, "normal", issue_heading=heading, top3_link_wrap=top3_link_wrap
    )
    if "<head" not in html_body.lower():
        title = html.escape(heading)
        head = (
            f"<head><meta charset=\"utf-8\"/>"
            f"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>"
            f"<title>{title}</title></head>"
        )
        html_body = html_body.replace("<html>", f"<html>{head}", 1)
    return html_body


def append_subscription_footer(html_body: str, public_app_url: str, unsub_token: str, manage_token: str) -> str:
    base = public_app_url.rstrip("/")
    block = (
        f"<hr style='border:none;border-top:1px solid #eee;margin:2rem 0'/>"
        f"<p style='font-size:13px;color:#666'>"
        f"<a href=\"{html.escape(base + '/api/unsubscribe?token=' + unsub_token, quote=True)}\">退订</a>"
        f" · "
        f"<a href=\"{html.escape(base + '/manage/' + manage_token, quote=True)}\">管理关键词与模式</a>"
        f"</p>"
    )
    if "</body>" in html_body:
        return html_body.replace("</body>", block + "</body>", 1)
    return html_body + block


def parse_payload_json(raw: str) -> dict[str, Any]:
    if not raw or raw.strip() == "":
        return ensure_payload_v3({})
    try:
        return ensure_payload_v3(json.loads(raw))
    except json.JSONDecodeError:
        return ensure_payload_v3({})
