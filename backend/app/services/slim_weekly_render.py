"""
Composer（LLM）只产出「短」结构化 JSON；PRD v3 完整正文由本模块确定性合并。
避免让模型一次性输出巨型嵌套 JSON → json.loads 截断/非法。

capabilities 仍来自上游 Capability Analyst（不入 Composer JSON，避免重复与超长）。
"""

from __future__ import annotations

from typing import Any


def slim_merge_to_prd_v3(
    slim: dict[str, Any] | None,
    *,
    capabilities: list[Any],
    glossary_fallback: dict[str, Any] | list[Any],
) -> dict[str, Any]:
    """
    slim 期望字段（均可扩展缺省）：
    - simple_lines: [{title, what_happened, what_it_means_for_you, url}]
    - top3, sections, tools, footer, glossary（可空）
    """
    slim = slim if isinstance(slim, dict) else {}

    lines = slim.get("simple_lines")
    if lines is None:
        lines = slim.get("lines")
    if not isinstance(lines, list):
        lines = []

    footer = str(slim.get("footer") or "")

    top3 = slim.get("top3")
    if not isinstance(top3, list):
        top3 = []

    sections = slim.get("sections")
    if not isinstance(sections, list):
        sections = []

    tools = slim.get("tools")
    if not isinstance(tools, list):
        tools = []

    gloss = slim.get("glossary")
    if not gloss:
        if isinstance(glossary_fallback, dict):
            gloss = glossary_fallback.get("glossary")
        else:
            gloss = glossary_fallback
    if not isinstance(gloss, list):
        gloss = []

    caps = capabilities if isinstance(capabilities, list) else []

    return {
        "simple": {"lines": lines, "footer": footer},
        "normal": {
            "top3": top3,
            "sections": sections,
            "capabilities": caps,
            "tools": tools,
        },
        "glossary": gloss,
    }


def is_full_prd_v3_payload(d: dict[str, Any]) -> bool:
    """若模型误输出完整 PRD v3，跳合并。"""
    s = d.get("simple")
    n = d.get("normal")
    return isinstance(s, dict) and isinstance(n, dict) and "lines" in s and "top3" in n
