from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.config import get_settings
from app.services.payload_schema import finalize_payload_v3


def _extract_json_block(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    raw = (m.group(1) if m else text).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start : end + 1])
        raise


def build_prompt(items: list[dict[str, Any]]) -> str:
    lines = []
    for i, it in enumerate(items[:60], 1):
        score = it.get("_score_total")
        lines.append(
            f"{i}. [{it.get('source','')}] {it.get('title','')}\n"
            f"   摘要: {it.get('summary','')[:500]}\n"
            f"   链接: {it.get('link','')}\n"
            f"   百分制评分: {score if score is not None else 0}\n"
            f"   热度分: {it.get('heat_score',0)}"
        )
    corpus = "\n".join(lines)
    return f"""你是面向非技术职场人的中文科技编辑。根据下列本周资讯（已按「百分制评分」由高到低排序），输出**严格 JSON**（不要 Markdown 外壳以外的文字）。

要求（PRD v3）：
1. simple：供 Simple 模式邮件；lines 3-5 条（优先 5 条），每项必须包含：
   - title：标题
   - what_happened：≤30 字，发生了什么（禁止堆砌术语）
   - what_it_means_for_you：对你意味着什么（用户视角）
   - url：必须来自资讯列表中的链接
2. normal：供 Normal 模式邮件。
   - top3：固定 3 条；每项含 title, url, what_happened, why_important（行业层）, what_it_means_for_you（用户层）, attention_level（字符串 "1"–"5"）
   - sections：固定 3 个板块，title 只能是「大模型更新」「工具/产品」「行业动态」；
     每板块含 items 数组，每项含 title, url, what_happened, suitable_for,
     worth_attention（High|Medium|Low）, what_it_means_for_you, see_top3（布尔）；
     若该条与 Top3 重复，see_top3=true 且重点写事实、少写判断。
   - capabilities：1–3 条能力进展，每项含 theme, can_do, cannot_do, cost, suitable_for, conclusion（一句话）
   - tools：0–3 条本周工具观察，每项含 name, can_do, suitable_for, worth_trying（Yes|No）, what_it_means_for_you
3. glossary：5–12 条，{{ "term", "explain": "≤50字" }}

资讯列表：
{corpus}

只输出 JSON，顶层结构示例：
{{
  "simple": {{ "lines": [{{"title":"...","what_happened":"...","what_it_means_for_you":"...","url":"..."}}], "footer": "..." }},
  "normal": {{ "top3": [...], "sections": [...], "capabilities": [...], "tools": [...] }},
  "glossary": [{{"term":"...","explain":"..."}}]
}}
"""


def summarize_items(items: list[dict[str, Any]]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.doubao_api_key or not settings.doubao_model:
        raise RuntimeError("Doubao / Ark not configured: set doubao_api_key and doubao_model.")

    prompt = build_prompt(items)
    url = f"{settings.doubao_api_base.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.doubao_model,
        "messages": [
            {"role": "system", "content": "You output valid JSON only for Chinese newsletter generation."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {settings.doubao_api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()

    content = data["choices"][0]["message"]["content"]
    parsed = _extract_json_block(content)
    return normalize_payload(parsed)


def normalize_payload(parsed: dict[str, Any]) -> dict[str, Any]:
    """兼容旧版 LLM 字段 + 收口为 PRD v3。"""
    email_payload = parsed.get("email_payload") if isinstance(parsed.get("email_payload"), dict) else None
    weekly_url_raw = parsed.get("weekly_url")
    simple = parsed.get("simple") or {}
    normal = parsed.get("normal") or {}
    glossary = parsed.get("glossary") or []

    lines_raw = simple.get("lines") if isinstance(simple.get("lines"), list) else []
    footer = str(simple.get("footer") or "")

    clean_lines: list[dict[str, str]] = []
    for ln in lines_raw:
        if isinstance(ln, dict):
            title = str(ln.get("title") or ln.get("text") or "").strip()
            url = str(ln.get("url") or "").strip()
            wh = str(ln.get("what_happened") or "").strip()
            wu = str(ln.get("what_it_means_for_you") or "").strip()
            if title or url:
                clean_lines.append(
                    {
                        "title": title[:300] or url[:300],
                        "what_happened": wh[:300],
                        "what_it_means_for_you": wu[:400] or "帮助你判断是否与本周工作相关。",
                        "url": url[:2048],
                    }
                )
        elif isinstance(ln, str) and ln.strip():
            clean_lines.append(
                {
                    "title": ln.strip()[:300],
                    "what_happened": ln.strip()[:30],
                    "what_it_means_for_you": "帮助你判断是否与本周工作相关。",
                    "url": "",
                }
            )

    clean_top3: list[dict[str, str]] = []
    for t in normal.get("top3") if isinstance(normal.get("top3"), list) else []:
        if isinstance(t, dict) and (t.get("title") or t.get("url")):
            clean_top3.append(
                {
                    "title": str(t.get("title", ""))[:200],
                    "url": str(t.get("url", ""))[:2048],
                    "what_happened": str(t.get("what_happened", ""))[:800],
                    "why_important": str(t.get("why_important", ""))[:800],
                    "what_it_means_for_you": str(t.get("what_it_means_for_you", ""))[:800],
                    "attention_level": str(t.get("attention_level") or "3")[:8],
                }
            )

    sections_out: list[dict[str, Any]] = []
    for s in normal.get("sections") if isinstance(normal.get("sections"), list) else []:
        if not isinstance(s, dict):
            continue
        st = str(s.get("title") or "")
        if "items" in s and isinstance(s.get("items"), list):
            sections_out.append({"title": st, "items": list(s.get("items") or [])})
        elif str(s.get("paragraph") or "").strip():
            sections_out.append(
                {
                    "title": st,
                    "items": [
                        {
                            "title": "本板块要点",
                            "url": "",
                            "what_happened": str(s.get("paragraph", ""))[:500],
                            "suitable_for": "",
                            "worth_attention": "Medium",
                            "what_it_means_for_you": "",
                            "see_top3": False,
                        }
                    ],
                }
            )

    caps_in = normal.get("capabilities")
    if not isinstance(caps_in, list):
        caps_in = []
    capabilities: list[dict[str, str]] = []
    for c in caps_in:
        if isinstance(c, dict) and str(c.get("theme") or "").strip():
            capabilities.append(
                {
                    "theme": str(c.get("theme", ""))[:200],
                    "can_do": str(c.get("can_do", ""))[:1200],
                    "cannot_do": str(c.get("cannot_do", ""))[:1200],
                    "cost": str(c.get("cost", ""))[:400],
                    "suitable_for": str(c.get("suitable_for", ""))[:400],
                    "conclusion": str(c.get("conclusion", ""))[:500],
                }
            )

    tools_in = normal.get("tools")
    if not isinstance(tools_in, list):
        tools_in = []
    tools: list[dict[str, str]] = []
    for t in tools_in:
        if isinstance(t, dict) and str(t.get("name") or "").strip():
            tools.append(
                {
                    "name": str(t.get("name", ""))[:200],
                    "can_do": str(t.get("can_do", ""))[:800],
                    "suitable_for": str(t.get("suitable_for", ""))[:400],
                    "worth_trying": str(t.get("worth_trying") or "No"),
                    "what_it_means_for_you": str(t.get("what_it_means_for_you", ""))[:800],
                }
            )

    clean_glossary: list[dict[str, str]] = []
    for g in glossary:
        if isinstance(g, dict) and g.get("term"):
            clean_glossary.append(
                {"term": str(g.get("term", ""))[:64], "explain": str(g.get("explain", ""))[:120]}
            )

    merged = {
        "simple": {"lines": clean_lines[:10], "footer": footer},
        "normal": {
            "top3": clean_top3[:5],
            "sections": sections_out,
            "capabilities": capabilities[:5],
            "tools": tools[:10],
        },
        "glossary": clean_glossary,
    }
    out = finalize_payload_v3(merged)
    if email_payload is not None:
        out = {**out, "email_payload": email_payload}
    if isinstance(weekly_url_raw, str) and weekly_url_raw.strip():
        out = {**out, "weekly_url": weekly_url_raw.strip()}
    return out


def payload_to_texts(payload: dict[str, Any]) -> tuple[str, str, str]:
    p = finalize_payload_v3(payload)
    s = p["simple"]
    n = p["normal"]
    g = p["glossary"]

    simple_lines_txt: list[str] = []
    for ln in s.get("lines", []):
        if isinstance(ln, dict):
            simple_lines_txt.append(
                f"{ln.get('title','')}\n  发生了什么：{ln.get('what_happened','')}\n"
                f"  对你意味着什么：{ln.get('what_it_means_for_you','')}\n"
                f"  链接：{ln.get('url','')}"
            )
        else:
            simple_lines_txt.append(str(ln))
    simple_text = "\n".join(simple_lines_txt)
    if s.get("footer"):
        simple_text += "\n\n" + str(s["footer"])

    normal_parts: list[str] = []
    if n.get("top3"):
        normal_parts.append("## Top3\n")
        for t in n["top3"]:
            if isinstance(t, dict):
                normal_parts.append(
                    "\n".join(
                        [
                            str(t.get("title", "")),
                            f"发生了什么：{t.get('what_happened','')}",
                            f"为什么重要：{t.get('why_important','')}",
                            f"对你意味着什么：{t.get('what_it_means_for_you','')}",
                            f"关注程度：{t.get('attention_level','')}",
                            str(t.get("url", "")),
                        ]
                    )
                )
    for sec in n.get("sections", []):
        if isinstance(sec, dict):
            buf = [f"## {sec.get('title','')}"]
            for it in sec.get("items") or []:
                if isinstance(it, dict):
                    buf.append(
                        "\n".join(
                            [
                                str(it.get("title", "")),
                                f"发生了什么：{it.get('what_happened','')}",
                                f"适合谁：{it.get('suitable_for','')}",
                                f"值得关注：{it.get('worth_attention','')}",
                                str(it.get("what_it_means_for_you", "")),
                                str(it.get("url", "")),
                            ]
                        )
                    )
            normal_parts.append("\n".join(buf))

    if n.get("capabilities"):
        normal_parts.append("## AI能力进展\n")
        for c in n["capabilities"]:
            if isinstance(c, dict):
                normal_parts.append(
                    "\n".join(
                        [
                            str(c.get("theme", "")),
                            str(c.get("can_do", "")),
                            str(c.get("cannot_do", "")),
                            str(c.get("conclusion", "")),
                        ]
                    )
                )

    if n.get("tools"):
        normal_parts.append("## 本周工具观察\n")
        for t in n["tools"]:
            if isinstance(t, dict):
                normal_parts.append(str(t.get("name", "")) + "\n" + str(t.get("can_do", "")))

    normal_text = "\n\n".join(normal_parts)

    glossary_json = json.dumps(g, ensure_ascii=False)
    return simple_text, normal_text, glossary_json
