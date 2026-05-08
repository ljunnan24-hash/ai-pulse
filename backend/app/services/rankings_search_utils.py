"""排行榜关键词搜索：LIKE 模式与 metrics 解析（无 FastAPI 依赖，便于单测）。"""

from __future__ import annotations

import json
from typing import Any


def normalize_rankings_q(raw: str | None) -> str | None:
    if raw is None:
        return None
    t = raw.strip()
    if not t:
        return None
    return t[:60]


def sql_like_pattern(term: str) -> str:
    """LIKE 模式：转义 % _ \\。"""
    esc = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{esc}%"


def industry_tags_from_metrics(metrics_json_str: str | None) -> list[dict[str, str]]:
    try:
        m = json.loads(metrics_json_str or "{}")
        if not isinstance(m, dict):
            return []
        it = m.get("industry_tags")
        if not isinstance(it, list):
            return []
        out: list[dict[str, str]] = []
        for x in it:
            if isinstance(x, dict) and x.get("slug") is not None and x.get("label") is not None:
                out.append({"slug": str(x["slug"]), "label": str(x["label"])})
        return out
    except Exception:
        return []
