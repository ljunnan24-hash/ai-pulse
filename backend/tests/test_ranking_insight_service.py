"""ranking_insight_service 纯函数与规范化逻辑。"""
from __future__ import annotations

from types import SimpleNamespace

from app.services.ranking_insight_service import (
    CAPABILITY_KEYS,
    derive_one_liner_fallback,
    finalize_one_liner_for_event,
    normalize_one_liner,
    pick_best_judgment_sentence,
    resolve_one_liner_for_api,
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


def _han_count(s: str) -> int:
    return sum(1 for c in s if "\u4e00" <= c <= "\u9fff")


def test_normalize_one_liner_truncates_han() -> None:
    s = "人工智能正在重塑办公流程并且会持续扩散到更多岗位这是额外汉字用于测试长度截断边界情况续写"
    out = normalize_one_liner(s)
    assert _han_count(out) <= 35
    assert "这表明" not in normalize_one_liner("这表明模型能力提升")


def test_normalize_one_liner_strips_hollow_opening() -> None:
    out = normalize_one_liner("这表明 AI 技术正在快速发展")
    assert "这表明" not in out
    assert "正在" in out or "发展" in out


def test_normalize_one_liner_none_and_whitespace() -> None:
    assert normalize_one_liner(None) == ""
    assert normalize_one_liner("") == ""
    assert normalize_one_liner("  \n\t  ") == ""


def test_derive_one_liner_fallback_first_sentence() -> None:
    t = "行业格局正在变化。另一方面监管也在加强。"
    assert derive_one_liner_fallback(t) == "行业格局正在变化"


def test_pick_best_prefers_judgment_sentence() -> None:
    t = "OpenAI 发布了新模型。产业窗口期正在收紧，中小团队面临洗牌。"
    best = pick_best_judgment_sentence(t)
    assert "窗口" in best or "洗牌" in best
    assert "发布" not in best


def test_finalize_replaces_pure_news_one_liner() -> None:
    out = finalize_one_liner_for_event(
        llm_one_liner="OpenAI 发布新模型",
        why_important="大模型迭代正在压缩创业窗口期，竞争焦点转向生态与成本。",
        what_happened="OpenAI 宣布推出新模型。",
        title="OpenAI 发布新模型",
    )
    assert "发布新模型" not in out
    assert ("窗口" in out or "竞争" in out or "生态" in out)


def test_resolve_one_liner_prefers_metrics_json_then_quality() -> None:
    ge = SimpleNamespace(
        metrics_json='{"one_liner":"企业级 Agent 进入落地阶段"}',
        why_important="备用",
        what_happened="",
        canonical_title="",
    )
    assert resolve_one_liner_for_api(ge) == "企业级 Agent 进入落地阶段"


def test_resolve_one_liner_fallback_why() -> None:
    ge = SimpleNamespace(
        metrics_json="{}",
        why_important="云厂商正在把推理成本压到可规模化商业部署的水平。后续竞争焦点在生态。",
        what_happened="",
        canonical_title="",
    )
    out = resolve_one_liner_for_api(ge)
    assert out
    assert _han_count(out) <= 35


def test_long_input_truncates_without_overflow() -> None:
    long_text = "人工智能" * 20
    out = normalize_one_liner(long_text)
    assert _han_count(out) <= 35
    assert isinstance(out, str)
