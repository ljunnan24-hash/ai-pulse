"""
Composer（LLM）只产出「短」结构化 JSON；PRD v3 完整正文由本模块确定性合并。
避免让模型一次性输出巨型嵌套 JSON → json.loads 截断/非法。

capabilities 仍来自上游 Capability Analyst（不入 Composer JSON，避免重复与超长）。
"""

from __future__ import annotations

from typing import Any

_PHASE35_NORMAL_KEYS = frozenset(
    {
        "weekly_thesis",
        "top3_judgments",
        "capability_boundaries",
        "tools_to_try",
        "noise_to_ignore",
        "category_recap",
    }
)


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

    normal_out: dict[str, Any] = {
        "top3": top3,
        "sections": sections,
        "capabilities": caps,
        "tools": tools,
    }
    if isinstance(slim, dict):
        for k in _PHASE35_NORMAL_KEYS:
            if k in slim and slim[k] is not None:
                normal_out[k] = slim[k]

    return {
        "simple": {"lines": lines, "footer": footer},
        "normal": normal_out,
        "glossary": gloss,
    }


def is_full_prd_v3_payload(d: dict[str, Any]) -> bool:
    """若模型误输出完整 PRD v3，跳合并。"""
    s = d.get("simple")
    n = d.get("normal")
    return isinstance(s, dict) and isinstance(n, dict) and "lines" in s and "top3" in n


def merge_phase35_into_payload(
    payload: dict[str, Any],
    *,
    capability_block: dict[str, Any] | None,
    thesis_block: dict[str, Any] | None,
    noise_block: dict[str, Any] | None,
) -> dict[str, Any]:
    """将 Thesis / Noise / Capability boundaries 注入 normal（Composer 之后再调用）。"""
    if not isinstance(payload, dict):
        return payload
    norm = payload.setdefault("normal", {})
    if not isinstance(norm, dict):
        return payload

    if isinstance(capability_block, dict):
        cb = capability_block.get("capability_boundaries")
        if isinstance(cb, list) and cb:
            norm["capability_boundaries"] = cb

    if isinstance(thesis_block, dict):
        wt = thesis_block.get("weekly_thesis")
        if isinstance(wt, dict) and (wt.get("headline") or wt.get("summary")):
            norm["weekly_thesis"] = wt

    if isinstance(noise_block, dict):
        nz = noise_block.get("noise_to_ignore")
        if isinstance(nz, list) and nz:
            norm["noise_to_ignore"] = nz

    return payload
