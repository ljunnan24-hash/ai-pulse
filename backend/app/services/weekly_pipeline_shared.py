"""
周刊 global slim 流水线共享类型与工具（与 legacy MultiAgentOrchestrator 解耦）。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)


def force_replace_text(obj: Any) -> Any:
    """弱化模糊措辞（Composer/Editor 后兜底，不改变 URL 结构）。"""
    if isinstance(obj, dict):
        return {k: force_replace_text(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [force_replace_text(i) for i in obj]
    if isinstance(obj, str):
        replacements = (
            ("可尝试", "建议使用"),
            ("可参考", "可以直接用"),
            ("有望", "将会"),
        )
        out = obj
        for k, v in replacements:
            out = out.replace(k, v)
        out = re.sub(r"(?<!性)可能(?!性)", "可以", out)
        return out
    return obj


@dataclass
class WeeklyPipelineResult:
    payload: dict[str, Any]
    audit_report: dict[str, Any]
    artifacts: dict[str, Any]
