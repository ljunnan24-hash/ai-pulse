"""
周报 Top3 产品规则回归（簇优先、category 贯通、event_id 协议）。

Case 1（同源 GPT 多稿合一 + AWS/Meta）与 Case 2（三条不同 OpenAI 事件）：
见 test_top3_topic_dedupe.py。
"""

from __future__ import annotations

from copy import deepcopy

from app.services.phase35_compat import (
    apply_locked_top3_merge_judgments,
    extract_clean_phase35_normal,
    sync_legacy_top3_from_judgments,
)
from app.services.payload_schema import finalize_payload_v3
from app.services.top3_selector import apply_locked_top3_merge


def test_finalize_payload_backfills_judgment_category_from_legacy_top3_case3():
    """judgment 无 category、legacy normal.top3 有时：finalize_payload_v3 回填。"""
    raw = {
        "normal": {
            "top3_judgments": [
                {
                    "title": "某条判断",
                    "what_happened": "发生了…",
                    "why_it_matters": "因为…",
                    "who_should_care": "",
                    "what_to_do_now": "",
                    "action_level": "观望",
                    "pulse_score": 70,
                    "source_urls": [],
                    "related_stable_keys": [],
                }
            ],
            "top3": [
                {
                    "title": "某条判断",
                    "url": "https://example.com/a",
                    "what_happened": "发生了…",
                    "why_important": "",
                    "what_it_means_for_you": "",
                    "attention_level": "3",
                    "category": "industry",
                }
            ],
        }
    }
    fin = finalize_payload_v3(deepcopy(raw))
    j0 = fin["normal"]["top3_judgments"][0]
    assert j0.get("category") == "industry"


def test_apply_locked_top3_merge_judgments_fills_category_from_locked_case3():
    """locked candidate 带 category 时写入 judgment（模型正文可仍无 category）。"""
    normal = {
        "top3_judgments": [
            {
                "title": "Judgment",
                "what_happened": "w",
                "related_event_ids": [],
                "source_urls": [],
            }
        ]
    }
    locked = [
        {
            "event_id": "101",
            "title": "Locked",
            "url": "https://locked.example/",
            "category": "tool_product",
            "source_urls": ["https://locked.example/"],
            "related_event_ids": ["101"],
        }
    ]
    apply_locked_top3_merge_judgments(normal, locked)
    assert normal["top3_judgments"][0].get("category") == "tool_product"


def test_apply_locked_top3_merge_writes_category_from_locked_row():
    """apply_locked_top3_merge：locked 行 category 进入 normal.top3。"""
    payload = {
        "normal": {
            "top3": [
                {
                    "title": "old",
                    "url": "",
                    "what_happened": "",
                    "why_important": "",
                    "what_it_means_for_you": "",
                    "attention_level": "3",
                }
            ],
        }
    }
    locked = [
        {
            "event_id": "55",
            "title": "L",
            "url": "https://x.test/",
            "category": "model_update",
            "source_urls": ["https://x.test/"],
            "related_event_ids": ["55"],
        }
    ]
    apply_locked_top3_merge(payload, locked)
    assert payload["normal"]["top3"][0].get("category") == "model_update"


def test_sync_legacy_top3_from_judgments_propagates_category():
    """sync_legacy_top3_from_judgments：judgment 的 category 同步到 legacy top3 行。"""
    normal = {
        "top3_judgments": [
            {
                "title": "T",
                "what_happened": "w",
                "why_it_matters": "m",
                "event_id": "9",
                "category": "industry",
            }
        ],
        "top3": [
            {
                "title": "legacy",
                "url": "",
                "what_happened": "",
                "why_important": "",
                "what_it_means_for_you": "",
                "attention_level": "3",
            }
        ],
    }
    sync_legacy_top3_from_judgments(normal)
    assert normal["top3"][0].get("category") == "industry"


def test_finalize_backfill_judgment_category_model_case1():
    """Case 1：judgment 无 category，legacy top3 有 category=model → finalize 后 judgment 带 category。"""
    raw = {
        "normal": {
            "top3_judgments": [
                {
                    "title": "判断标题",
                    "what_happened": "x",
                    "why_it_matters": "y",
                    "who_should_care": "",
                    "what_to_do_now": "",
                    "action_level": "观望",
                    "pulse_score": 70,
                    "source_urls": [],
                    "related_stable_keys": [],
                }
            ],
            "top3": [
                {
                    "title": "判断标题",
                    "url": "https://example.com/a",
                    "what_happened": "x",
                    "why_important": "",
                    "what_it_means_for_you": "",
                    "attention_level": "3",
                    "category": "model",
                }
            ],
        }
    }
    fin = finalize_payload_v3(deepcopy(raw))
    assert fin["normal"]["top3_judgments"][0].get("category") == "model"


def test_finalize_backfill_from_legacy_category_slug_only():
    """legacy 仅 category_slug 时，pick_category_fields 仍可回填 judgment.category。"""
    raw = {
        "normal": {
            "top3_judgments": [
                {
                    "title": "T",
                    "what_happened": "x",
                    "why_it_matters": "y",
                    "who_should_care": "",
                    "what_to_do_now": "",
                    "action_level": "观望",
                    "pulse_score": 1,
                    "source_urls": [],
                    "related_stable_keys": [],
                }
            ],
            "top3": [
                {
                    "title": "T",
                    "url": "https://z/",
                    "what_happened": "x",
                    "why_important": "",
                    "what_it_means_for_you": "",
                    "attention_level": "3",
                    "category_slug": "model_update",
                }
            ],
        }
    }
    fin = finalize_payload_v3(deepcopy(raw))
    assert fin["normal"]["top3_judgments"][0].get("category") == "model_update"


def test_sync_legacy_top3_from_judgments_does_not_drop_category():
    """judgment 有 category 时写入 legacy top3；不会清空已有分类路径。"""
    normal = {
        "top3_judgments": [
            {
                "title": "T",
                "what_happened": "w",
                "why_it_matters": "m",
                "category": "industry",
                "event_id": "9",
            }
        ],
        "top3": [
            {
                "title": "legacy",
                "url": "",
                "what_happened": "",
                "why_important": "",
                "what_it_means_for_you": "",
                "attention_level": "3",
                "category": "tool_product",
            }
        ],
    }
    sync_legacy_top3_from_judgments(normal)
    assert normal["top3"][0].get("category") == "industry"


def test_extract_clean_preserves_non_numeric_event_id_case4():
    """非数字字符串 event_id（如池索引键）原样保留；生产路径应以 GlobalEvent 数字 id 为主事件。"""
    raw_normal = {
        "top3_judgments": [
            {
                "title": "簇主事件",
                "event_id": "e_gpt1",
                "related_event_ids": ["e_gpt1", "e_gpt2"],
                "what_happened": "x",
                "why_it_matters": "y",
                "who_should_care": "",
                "what_to_do_now": "",
                "action_level": "观望",
                "pulse_score": 80,
                "source_urls": ["https://openai.com/a"],
                "related_stable_keys": [],
            }
        ]
    }
    out = extract_clean_phase35_normal(raw_normal)
    j = out["top3_judgments"][0]
    assert j["event_id"] == "e_gpt1"
    assert j["related_event_ids"][0] == "e_gpt1"
