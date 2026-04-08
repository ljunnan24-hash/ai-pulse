from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.config import get_settings


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
        lines.append(
            f"{i}. [{it.get('source','')}] {it.get('title','')}\n"
            f"   摘要: {it.get('summary','')[:500]}\n"
            f"   链接: {it.get('link','')}\n"
            f"   热度分: {it.get('heat_score',0)}"
        )
    corpus = "\n".join(lines)
    return f"""你是面向非技术职场人的中文科技编辑。根据下列本周资讯（已按热度大致排序），输出**严格 JSON**（不要 Markdown 外壳以外的文字）。

要求：
1. simple：≤300 字等价的短讯。
   - lines：数组，3-5 条，每项必须包含标题与链接：{{"text":"...","url":"https://..."}}（url 必须来自资讯列表中的链接）。
   - text 必须是“一句话”，不要包含子编号格式（不要出现 1.1 / 2.3 / 1）——序号由渲染层自动生成。
   - footer：一句话总结「本周 AI 突破对普通人的影响」。术语不要解释，留在正文里。
2. normal：1200-1500 字左右。
   - top3：数组，3 条本周热点，每项必须包含标题与链接：{{"title":"...","url":"https://..."}}（url 必须来自资讯列表中的链接）。
   - sections：数组，每项 {{ "title": "大模型更新"|"AI工具/产品发布"|"行业重要动态", "paragraph": "该板块正文，非技术向，事件+影响。引用来源时请直接写出 url（不要用 markdown 链接语法）" }}。按热度组织，可引用来源链接。
3. glossary：数组，每项 {{ "term": "术语", "explain": "≤50字通俗中文解释" }}，覆盖正文中较难术语，5-12 个。

资讯列表：
{corpus}

只输出 JSON，结构如下：
{{
  "simple": {{ "lines": [{{"text":"...","url":"..."}}, {{"text":"...","url":"..."}}], "footer": "..." }},
  "normal": {{ "top3": [{{"title":"...","url":"..."}}, {{"title":"...","url":"..."}}, {{"title":"...","url":"..."}}], "sections": [{{"title":"...","paragraph":"..."}}] }},
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
    simple = parsed.get("simple") or {}
    normal = parsed.get("normal") or {}
    glossary = parsed.get("glossary") or []

    lines_raw = simple.get("lines") if isinstance(simple.get("lines"), list) else []
    footer = str(simple.get("footer") or "")
    top3_raw = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    sections = normal.get("sections") if isinstance(normal.get("sections"), list) else []

    clean_lines: list[dict[str, str]] = []
    for ln in lines_raw:
        if isinstance(ln, dict) and ln.get("text") and ln.get("url"):
            clean_lines.append({"text": str(ln["text"])[:300], "url": str(ln["url"])[:2048]})
        elif isinstance(ln, str) and ln.strip():
            clean_lines.append({"text": ln.strip()[:300], "url": ""})

    clean_top3: list[dict[str, str]] = []
    for t in top3_raw:
        if isinstance(t, dict) and t.get("title") and t.get("url"):
            clean_top3.append({"title": str(t["title"])[:200], "url": str(t["url"])[:2048]})
        elif isinstance(t, str) and t.strip():
            clean_top3.append({"title": t.strip()[:200], "url": ""})

    clean_glossary: list[dict[str, str]] = []
    for g in glossary:
        if isinstance(g, dict) and g.get("term"):
            clean_glossary.append(
                {"term": str(g.get("term", ""))[:64], "explain": str(g.get("explain", ""))[:120]}
            )

    return {
        "simple": {"lines": clean_lines[:10], "footer": footer},
        "normal": {
            "top3": clean_top3[:5],
            "sections": [
                {"title": str(s.get("title", "")), "paragraph": str(s.get("paragraph", ""))}
                for s in sections
                if isinstance(s, dict)
            ],
        },
        "glossary": clean_glossary,
    }


def payload_to_texts(payload: dict[str, Any]) -> tuple[str, str, str]:
    s = payload["simple"]
    n = payload["normal"]
    g = payload["glossary"]

    simple_lines_txt: list[str] = []
    for ln in s.get("lines", []):
        if isinstance(ln, dict):
            text = str(ln.get("text", ""))
            url = str(ln.get("url", ""))
            simple_lines_txt.append(f"{text} ({url})" if url else text)
        else:
            simple_lines_txt.append(str(ln))
    simple_text = "\n".join(simple_lines_txt)
    if s.get("footer"):
        simple_text += "\n\n" + str(s["footer"])

    normal_parts: list[str] = []
    if n.get("top3"):
        top3_lines: list[str] = []
        for t in n["top3"]:
            if isinstance(t, dict):
                title = str(t.get("title", ""))
                url = str(t.get("url", ""))
                top3_lines.append(f"- {title} ({url})" if url else f"- {title}")
            else:
                top3_lines.append(f"- {t}")
        normal_parts.append("## 本周 AI 热点排行（Top3）\n" + "\n".join(top3_lines))
    for sec in n.get("sections", []):
        normal_parts.append(f"## {sec.get('title','')}\n\n{sec.get('paragraph','')}")
    normal_text = "\n\n".join(normal_parts)

    glossary_json = json.dumps(g, ensure_ascii=False)
    return simple_text, normal_text, glossary_json
