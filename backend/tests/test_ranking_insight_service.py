"""ranking_insight_service 纯函数与规范化逻辑。"""
from __future__ import annotations

from types import SimpleNamespace

from app.services.ranking_insight_service import (
    CAPABILITY_KEYS,
    _normalize_action,
    _normalize_capability_tags,
    _strip_banned,
    needs_ranking_insight_refresh,
    _text_has_placeholder,
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


def test_placeholder_detection() -> None:
    assert _text_has_placeholder("若与你的场景相关，建议跟进") is True
    assert _text_has_placeholder("建议安排短时间跟进官方动态") is True
    assert _text_has_placeholder("该事件仍在分析中") is True
    assert _text_has_placeholder("OpenAI 发布新模型") is False


def test_needs_refresh_placeholder_vs_applied() -> None:
    ge_ph = SimpleNamespace(
        what_happened="摘要",
        why_important="行业",
        what_it_means_for_you="若与你的场景相关，建议安排短时间跟进官方动态或试用入口。",
        action_suggestion="先观望",
        metrics_json='{"ranking_insight":{"applied":true}}',
    )
    assert needs_ranking_insight_refresh(ge_ph) is True

    ge_ok = SimpleNamespace(
        what_happened="事实",
        why_important="意义",
        what_it_means_for_you="你现在可以用官方试用入口验证是否替代现有流程。",
        action_suggestion="现在试用",
        metrics_json='{"ranking_insight":{"applied":true}}',
    )
    assert needs_ranking_insight_refresh(ge_ok) is False

    ge_no_applied = SimpleNamespace(
        what_happened="",
        why_important="",
        what_it_means_for_you="",
        action_suggestion="",
        metrics_json="{}",
    )
    assert needs_ranking_insight_refresh(ge_no_applied) is True
