"""P0 Top3 用户价值层回归样例（unittest，无需 pytest）。"""

from __future__ import annotations

import unittest

from app.services.payload_schema import finalize_payload_v3, validate_payload
from app.services.top3_selector import (
    build_top3_comparison_log,
    calculate_top3_score,
    calculate_top3_score_legacy_for_audit,
    estimate_user_value_fallback,
    is_valid_top3_candidate,
    passes_user_value_hard_gates,
    select_top3,
)


def _ev(
    *,
    eid: str,
    title: str,
    heat_score: float = 50,
    source_type: str = "media",
    user_value_score: float = 60,
    actionability: str = "watch",
    one_liner: str = "",
    _text_blob: str = "",
    category: str = "tool_product",
) -> dict:
    return {
        "event_id": eid,
        "title": title,
        "url": f"https://example.com/{eid}",
        "category": category,
        "confidence": 0.9,
        "fact_status": "ok",
        "base_score": 70,
        "heat_score": heat_score,
        "freshness_score": 85,
        "source_trust_score": 78,
        "relevance_score": 68,
        "source_type": source_type,
        "attention_level": "Medium",
        "one_liner": one_liner or title[:40],
        "_text_blob": _text_blob,
        "user_value_score": user_value_score,
        "user_value_reason": "test",
        "audience_type": "general_user",
        "actionability": actionability,
        "user_value_from_impact": True,
    }


class Top3UserValueRegression(unittest.TestCase):
    def test_github_hot_dev_tool_not_top3_when_uv_low(self):
        """GitHub stars 高但偏开发者工具 → user_value 过低不应进 Top3。"""
        events = [
            _ev(
                eid="e01",
                title="CUDA kernel benchmark suite v3 open-sourced",
                heat_score=98,
                source_type="github",
                user_value_score=42,
                actionability="not_for_general_user",
                _text_blob="benchmark pytorch cuda optimized kernels",
            ),
            _ev(eid="e02", title="某大厂上线对话助手小程序", heat_score=40, user_value_score=76),
            _ev(eid="e03", title="AI 写作助手开放免费试用", heat_score=35, user_value_score=74),
            _ev(eid="e04", title="行业媒体报道模型新规", heat_score=30, user_value_score=62),
        ]
        for e in events:
            e["top3_score"] = calculate_top3_score(e)
        picked = select_top3(events)
        ids = [x["event_id"] for x in picked]
        self.assertNotIn("e01", ids)

    def test_consumer_ai_product_can_enter_top3(self):
        """普通用户可直接使用的新产品 → 高 UV，可进 Top3。"""
        events = [
            _ev(
                eid="e01",
                title="新款 AI 备忘录上线：免费注册即用",
                heat_score=45,
                user_value_score=82,
                actionability="now_try",
                _text_blob="开放注册 免费 App 网页版",
            ),
            _ev(eid="e02", title="论文：注意力机制改进", heat_score=20, user_value_score=44, category="industry"),
            _ev(eid="e03", title="融资快讯", heat_score=50, user_value_score=58),
        ]
        for e in events:
            e["top3_score"] = calculate_top3_score(e)
            # e02 fails UV gate
            if e["event_id"] == "e02":
                e["user_value_score"] = 44
        picked = select_top3(events)
        self.assertTrue(any(x["event_id"] == "e01" for x in picked))

    def test_funding_news_downweighted_in_fallback(self):
        """融资新闻无行动点 → 兜底分数偏低。"""
        score, reason = estimate_user_value_fallback(
            {
                "title": "某初创完成 B 轮融资 2 亿美元",
                "one_liner": "",
                "_text_blob": "融资 轮次 估值",
                "source_type": "media",
            }
        )
        self.assertLess(score, 65)
        self.assertIn("融资", reason)

    def test_technical_release_excluded_when_not_for_general_user(self):
        """官方大模型发布但 actionability 标记非大众 → 硬门槛拦截。"""
        ev = _ev(
            eid="e01",
            title="Foundation Model Technical Report & weights",
            source_type="official",
            user_value_score=80,
            actionability="not_for_general_user",
        )
        self.assertFalse(passes_user_value_hard_gates(ev))
        self.assertFalse(is_valid_top3_candidate(ev))

    def test_finance_multi_agent_framework_dev_bias(self):
        """多智能体金融/量化框架 → 开发者向则不应自动进 Top3。"""
        ev = _ev(
            eid="e01",
            title="开源多智能体量化交易回测框架",
            heat_score=90,
            source_type="github",
            user_value_score=48,
            actionability="not_for_general_user",
            _text_blob="量化 trading backtest orchestration",
        )
        self.assertFalse(is_valid_top3_candidate(ev))

    def test_legacy_rank_can_outrank_uv_on_old_formula(self):
        """对比日志：旧公式仍可能把 GitHub 热度排前（用于日志对照）。"""
        events = [
            _ev(eid="e01", title="GitHub trending ML repo", heat_score=95, source_type="github", user_value_score=50),
            _ev(eid="e02", title="普通人可用的 AI 日历", heat_score=30, user_value_score=85),
        ]
        leg = [calculate_top3_score_legacy_for_audit(events[0]), calculate_top3_score_legacy_for_audit(events[1])]
        new_uv = [calculate_top3_score(events[0]), calculate_top3_score(events[1])]
        self.assertGreater(leg[0], leg[1])
        self.assertGreater(new_uv[1], new_uv[0])

    def test_finalize_accepts_short_top3(self):
        """allow_short_top3 时 normal.top3 可为 1–2 条并通过校验。"""
        raw = {
            "allow_short_top3": True,
            "simple": {"lines": [], "footer": ""},
            "normal": {
                "top3": [
                    {
                        "title": "A",
                        "url": "https://a.com",
                        "what_happened": "x",
                        "why_important": "y",
                        "what_it_means_for_you": "现在用",
                        "attention_level": "3",
                    },
                    {
                        "title": "B",
                        "url": "https://b.com",
                        "what_happened": "x",
                        "why_important": "y",
                        "what_it_means_for_you": "先观望",
                        "attention_level": "3",
                    },
                ],
                "sections": [],
                "capabilities": [],
                "tools": [],
            },
            "glossary": [],
        }
        fin = finalize_payload_v3(raw)
        errs = validate_payload(fin)
        self.assertEqual(len(errs), 0)
        self.assertEqual(len(fin["normal"]["top3"]), 2)


if __name__ == "__main__":
    unittest.main()
