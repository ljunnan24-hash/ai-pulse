"""Top3 主题签名去重：同源英文多稿只占一席。"""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

from app.services.top3_selector import (
    is_duplicate_event,
    is_same_topic_by_signature,
    merge_top3_duplicate_into,
    select_top3,
)


def _base_ev(
    *,
    eid: str,
    title: str,
    url_suffix: str,
    category: str = "model_update",
    user_value_score: float = 72.0,
    _text_blob: str = "",
) -> dict:
    ts = datetime(2026, 5, 5, 12, 0, tzinfo=timezone.utc)
    return {
        "event_id": eid,
        "title": title,
        "url": f"https://news.example.com/{url_suffix}",
        "category": category,
        "confidence": 0.9,
        "fact_status": "ok",
        "base_score": 75,
        "heat_score": 55,
        "freshness_score": 85,
        "source_trust_score": 78,
        "relevance_score": 70,
        "source_type": "media",
        "attention_level": "Medium",
        "one_liner": title[:80],
        "_text_blob": _text_blob or title,
        "user_value_score": user_value_score,
        "user_value_reason": "test",
        "audience_type": "general_user",
        "actionability": "watch",
        "user_value_from_impact": True,
        "published_at": ts,
    }


class Top3TopicDedupe(unittest.TestCase):
    def test_three_gpt55_headlines_are_same_topic(self):
        a = _base_ev(
            eid="e1",
            title="GPT-5.5 Instant: smarter, clearer, and more personalized",
            url_suffix="a",
        )
        b = _base_ev(
            eid="e2",
            title="OpenAI releases GPT-5.5 Instant, a new default model for ChatGPT",
            url_suffix="b",
        )
        c = _base_ev(
            eid="e3",
            title="OpenAI claims ChatGPT's new default model hallucinates way less",
            url_suffix="c",
        )
        self.assertTrue(is_same_topic_by_signature(a, b))
        self.assertTrue(is_same_topic_by_signature(b, c))
        self.assertTrue(is_duplicate_event(a, c))

    def test_select_top3_collapses_gpt_cluster_and_keeps_aws_meta(self):
        events = [
            _base_ev(
                eid="e_gpt1",
                title="GPT-5.5 Instant: smarter, clearer, and more personalized",
                url_suffix="gpt1",
                user_value_score=90,
            ),
            _base_ev(
                eid="e_gpt2",
                title="OpenAI releases GPT-5.5 Instant, a new default model for ChatGPT",
                url_suffix="gpt2",
                user_value_score=88,
            ),
            _base_ev(
                eid="e_gpt3",
                title="OpenAI claims ChatGPT's new default model hallucinates way less",
                url_suffix="gpt3",
                user_value_score=87,
            ),
            _base_ev(
                eid="e_aws",
                title="AWS expands Bedrock agent workflow tools",
                url_suffix="aws",
                category="tool_product",
                user_value_score=80,
                _text_blob="Amazon Bedrock agents workflow expansion enterprise",
            ),
            _base_ev(
                eid="e_meta",
                title="Meta faces copyright lawsuit over AI training data",
                url_suffix="meta",
                category="industry",
                user_value_score=78,
                _text_blob="copyright lawsuit training data policy",
            ),
        ]

        picked = select_top3(events)
        self.assertEqual(len(picked), 3)

        titles_lower = [str(x.get("title") or "").lower() for x in picked]
        gpt_hits = sum(1 for t in titles_lower if "gpt" in t or "openai" in t or "chatgpt" in t)
        self.assertEqual(gpt_hits, 1, picked)

        ids = {str(x.get("event_id")) for x in picked}
        self.assertTrue({"e_aws", "e_meta"} <= ids)

        # 最高分 GPT 稿为 canonical；合并稿 URL 进入 source_urls
        keeper = next(x for x in picked if x["event_id"].startswith("e_gpt"))
        su = keeper.get("source_urls") or []
        self.assertGreaterEqual(len(su), 3, keeper)

    def test_three_openai_cn_events_same_week_are_not_dupes_full_top3(self):
        """同一周三条 OpenAI 不同动作轴：两两不判重，且可填满 Top3。"""
        ts = datetime(2026, 5, 5, 12, 0, tzinfo=timezone.utc)
        e1 = _base_ev(
            eid="e_cn1",
            title="GPT-5.5 默认模型更新",
            url_suffix="cn1",
            user_value_score=85,
        )
        e2 = _base_ev(
            eid="e_cn2",
            title="OpenAI API 价格变化",
            url_suffix="cn2",
            user_value_score=84,
        )
        e3 = _base_ev(
            eid="e_cn3",
            title="OpenAI 企业 Agent 工具更新",
            url_suffix="cn3",
            user_value_score=83,
        )
        for ev in (e1, e2, e3):
            ev["published_at"] = ts

        self.assertFalse(is_duplicate_event(e1, e2))
        self.assertFalse(is_duplicate_event(e1, e3))
        self.assertFalse(is_duplicate_event(e2, e3))

        picked = select_top3([e1, e2, e3])
        self.assertEqual(len(picked), 3)
        self.assertEqual({str(x.get("event_id")) for x in picked}, {"e_cn1", "e_cn2", "e_cn3"})

    def test_same_company_same_product_different_action_family_not_dup(self):
        """同公司同产品线（GPT / API）但动作轴冲突 → 不判重。"""
        a = _base_ev(eid="e_pub", title="OpenAI 发布 GPT-5.5", url_suffix="pub")
        b = _base_ev(eid="e_price", title="OpenAI 调整 API 价格", url_suffix="price")
        self.assertFalse(is_duplicate_event(a, b))

    def test_same_gpt55_event_two_headlines_are_dupes(self):
        """同事件不同英文标题：叙事特例判重。"""
        a = _base_ev(eid="e_a", title="OpenAI releases GPT-5.5 Instant", url_suffix="da")
        b = _base_ev(
            eid="e_b",
            title="ChatGPT new default model reduces hallucinations",
            url_suffix="db",
        )
        self.assertTrue(is_duplicate_event(a, b))

    def test_merge_accumulates_urls(self):
        k = _base_ev(eid="e1", title="OpenAI GPT story", url_suffix="x1")
        d = _base_ev(eid="e2", title="OpenAI GPT detail", url_suffix="x2")
        merge_top3_duplicate_into(k, d)
        self.assertIn("https://news.example.com/x2", k.get("_top3_merged_urls", []))


if __name__ == "__main__":
    unittest.main()
