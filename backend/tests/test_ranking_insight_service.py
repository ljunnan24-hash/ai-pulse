"""ranking_insight_service 纯函数与规范化逻辑。"""
from __future__ import annotations

from app.services.ranking_insight_service import (
    CAPABILITY_KEYS,
    _normalize_action,
    _normalize_capability_tags,
    _strip_banned,
)


def test_normalize_action() -> None:
    assert _normalize_action("现在试用") == "现在试用"
    assert _normalize_action(" 先观望 ") == "先观望"
    assert _normalize_action("随便") == "先观望"


def test_normalize_capability_tags() -> None:
    raw = {"reasoning": 0.5, "coding": 2.0, "unknown": 1.0}
    out = _normalize_capability_tags(raw)
    assert len(out) == len(CAPABILITY_KEYS)
    assert out["reasoning"] == 0.5
    assert out["coding"] == 1.0
    assert out["safety"] == 0.0


def test_strip_banned() -> None:
    assert "可能" not in _strip_banned("这可能很重要")
    assert _strip_banned("正常句子") == "正常句子"
