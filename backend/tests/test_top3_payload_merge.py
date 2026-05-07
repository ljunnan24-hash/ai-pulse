"""Top3 locked 字段贯通 payload、中文标题优先、source_urls 合并。"""

from __future__ import annotations

import unittest
from copy import deepcopy
from datetime import datetime, timezone

from app.services.phase35_compat import (
    apply_locked_top3_merge_judgments,
    merge_top3_source_urls_judgment_locked,
    resolve_top3_judgment_display_title,
)
from app.services.payload_schema import finalize_payload_v3, validate_payload
from app.services.top3_selector import (
    apply_locked_top3_merge,
    materialize_top3_public_fields,
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


class Top3PayloadMerge(unittest.TestCase):
    def test_case1_gpt55_cluster_source_urls_and_judgments(self):
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
        gpt_keeper = next(x for x in picked if str(x.get("event_id", "")).startswith("e_gpt"))
        self.assertGreaterEqual(len(gpt_keeper.get("source_urls") or []), 3)
        re = gpt_keeper.get("related_event_ids") or []
        self.assertTrue({"e_gpt2", "e_gpt3"}.issubset(set(re)), re)

        normal: dict = {
            "top3_judgments": [
                {
                    "title": "占位",
                    "what_happened": "a",
                    "why_it_matters": "b",
                    "who_should_care": "c",
                    "what_to_do_now": "d",
                    "action_level": "先观望",
                    "source_urls": [],
                    "related_event_ids": [],
                    "related_stable_keys": [],
                },
                {"title": "x", "what_happened": "a", "why_it_matters": "b", "who_should_care": "c", "what_to_do_now": "d", "action_level": "先观望"},
                {"title": "y", "what_happened": "a", "why_it_matters": "b", "who_should_care": "c", "what_to_do_now": "d", "action_level": "先观望"},
            ]
        }
        apply_locked_top3_merge_judgments(normal, picked)
        j0 = normal["top3_judgments"][0]
        self.assertGreaterEqual(len(j0.get("source_urls") or []), 3)
        self.assertTrue({"e_gpt2", "e_gpt3"}.issubset(set(j0.get("related_event_ids") or [])), j0)

    def test_case2_keep_chinese_title_when_locked_english(self):
        j = {"title": "OpenAI 发布新一代默认模型", "title_zh": "", "headline_zh": ""}
        lk = {"title": "OpenAI releases GPT-5.5 Instant for ChatGPT"}
        self.assertEqual(resolve_top3_judgment_display_title(j, lk), "OpenAI 发布新一代默认模型")

    def test_case3_use_locked_chinese_when_judgment_not_chinese(self):
        j = {"title": "Some English headline only"}
        lk = {"title": "OpenAI 调整默认模型策略"}
        self.assertEqual(resolve_top3_judgment_display_title(j, lk), "OpenAI 调整默认模型策略")

    def test_case4_source_urls_dedupe_primary_first(self):
        # normalize_url 会移除 utm_source 等追踪参数，故与主 URL 视为同源去重
        j = {"source_urls": ["https://news.example.com/a?utm_source=x"]}
        lk = {
            "url": "https://news.example.com/a",
            "source_urls": [
                "https://news.example.com/a",
                "https://news.example.com/b",
            ],
        }
        materialize_top3_public_fields(lk)
        merged = merge_top3_source_urls_judgment_locked(j, lk, max_n=8)
        self.assertLessEqual(len(merged), 8)
        self.assertEqual(merged[0], "https://news.example.com/a")
        self.assertEqual(len(merged), 2)

    def test_finalize_payload_keeps_top3_lists(self):
        raw = {
            "simple": {"lines": [], "footer": ""},
            "normal": {
                "top3": [
                    {
                        "title": "T",
                        "url": "https://u.com/1",
                        "what_happened": "w",
                        "why_important": "y",
                        "what_it_means_for_you": "m",
                        "attention_level": "3",
                        "source_urls": ["https://u.com/1", "https://u.com/2"],
                        "related_event_ids": ["e1", "e2"],
                        "related_stable_keys": ["k1"],
                    },
                    {
                        "title": "T2",
                        "url": "",
                        "what_happened": "w",
                        "why_important": "y",
                        "what_it_means_for_you": "m",
                        "attention_level": "3",
                    },
                    {
                        "title": "T3",
                        "url": "",
                        "what_happened": "w",
                        "why_important": "y",
                        "what_it_means_for_you": "m",
                        "attention_level": "3",
                    },
                ],
                "sections": [],
                "capabilities": [],
                "tools": [],
            },
            "glossary": [],
            "allow_short_top3": True,
        }
        fin = finalize_payload_v3(deepcopy(raw))
        t0 = fin["normal"]["top3"][0]
        self.assertEqual(t0.get("source_urls"), ["https://u.com/1", "https://u.com/2"])
        self.assertEqual(t0.get("related_event_ids"), ["e1", "e2"])
        errs = validate_payload(fin)
        self.assertEqual(len(errs), 0)

    def test_apply_locked_top3_merge_prefers_composer_chinese_title(self):
        payload = {
            "normal": {
                "top3": [
                    {
                        "title": "国产模型更新综述",
                        "url": "https://x.com",
                        "what_happened": "wh",
                        "why_important": "wi",
                        "what_it_means_for_you": "wu",
                        "attention_level": "3",
                    }
                ]
            }
        }
        locked = [
            {
                "title": "GPT-5.5 Instant English headline",
                "url": "https://x.com",
                "event_id": "e1",
                "source_urls": ["https://x.com"],
                "related_event_ids": ["e1"],
                "related_stable_keys": [],
            }
        ]
        apply_locked_top3_merge(payload, locked)
        self.assertIn("国产模型", payload["normal"]["top3"][0]["title"])


if __name__ == "__main__":
    unittest.main()
