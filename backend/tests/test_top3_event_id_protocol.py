"""Top3 event_id / related_event_ids 协议：站内跳转与 finalize 保留字段。"""

from app.services.phase35_compat import apply_locked_top3_merge_judgments, extract_clean_phase35_normal
from app.services.payload_schema import ensure_payload_v3
from app.services.top3_selector import (
    apply_locked_top3_merge,
    materialize_top3_public_fields,
    merge_top3_duplicate_into,
)


def test_materialize_keeps_event_id_first_in_related():
    row = {
        "event_id": "100",
        "url": "https://primary.example/a",
        "_top3_merged_event_ids": ["101", "102"],
        "_top3_merged_urls": ["https://b.example/x"],
    }
    materialize_top3_public_fields(row)
    assert row.get("event_id") == "100"
    assert row["related_event_ids"][0] == "100"
    assert "101" in row["related_event_ids"]
    assert row["source_urls"][0] == "https://primary.example/a"


def test_merge_three_dupes_related_contains_primary_and_merged():
    keeper = {
        "event_id": "e_gpt1",
        "url": "https://openai.com/main",
        "title": "t1",
    }
    dup2 = {"event_id": "e_gpt2", "url": "https://openai.com/2", "title": "t2"}
    dup3 = {"event_id": "e_gpt3", "url": "https://openai.com/3", "title": "t3"}
    merge_top3_duplicate_into(keeper, dup2)
    merge_top3_duplicate_into(keeper, dup3)
    materialize_top3_public_fields(keeper)
    assert keeper["event_id"] == "e_gpt1"
    assert keeper["related_event_ids"][0] == "e_gpt1"
    assert set(keeper["related_event_ids"]) >= {"e_gpt1", "e_gpt2", "e_gpt3"}


def test_apply_locked_top3_merge_writes_event_id():
    payload = {
        "normal": {
            "top3": [{"title": "old", "url": "", "what_happened": "", "why_important": "", "what_it_means_for_you": "", "attention_level": "3"}],
        }
    }
    locked = [
        {
            "event_id": "42",
            "title": "Locked title",
            "url": "https://x.test/",
            "attention_level": "high",
            "source_urls": ["https://x.test/"],
            "related_event_ids": ["42"],
        }
    ]
    apply_locked_top3_merge(payload, locked)
    t0 = payload["normal"]["top3"][0]
    assert t0.get("event_id") == "42"
    assert t0["related_event_ids"][0] == "42"


def test_apply_locked_top3_merge_judgments_locked_wins_event_id():
    normal = {
        "top3_judgments": [
            {
                "title": "Judgment",
                "what_happened": "wh",
                "event_id": "wrong",
                "related_event_ids": ["wrong", "x"],
                "source_urls": [],
            }
        ]
    }
    locked = [
        {
            "event_id": "correct",
            "title": "L",
            "url": "https://correct.example/",
            "source_urls": ["https://correct.example/"],
            "related_event_ids": ["correct", "z"],
        }
    ]
    apply_locked_top3_merge_judgments(normal, locked)
    j = normal["top3_judgments"][0]
    assert j["event_id"] == "correct"
    assert j["related_event_ids"][0] == "correct"


def test_apply_locked_top3_merge_judgments_fills_missing_event_id():
    normal = {"top3_judgments": [{"title": "J", "what_happened": "w", "related_event_ids": [], "source_urls": []}]}
    locked = [{"event_id": "99", "title": "L", "url": "https://u/", "source_urls": ["https://u/"], "related_event_ids": ["99"]}]
    apply_locked_top3_merge_judgments(normal, locked)
    assert normal["top3_judgments"][0]["event_id"] == "99"


def test_extract_clean_phase35_preserves_event_id_and_order():
    raw = {
        "top3_judgments": [
            {
                "title": "T",
                "event_id": "7",
                "related_event_ids": ["9", "7", "8"],
                "what_happened": "",
                "why_it_matters": "",
                "who_should_care": "",
                "what_to_do_now": "",
                "action_level": "先观望",
                "pulse_score": 80,
                "source_urls": [],
                "related_stable_keys": [],
            }
        ]
    }
    out = extract_clean_phase35_normal(raw)
    j0 = out["top3_judgments"][0]
    assert j0["event_id"] == "7"
    assert j0["related_event_ids"][0] == "7"


def test_ensure_payload_v3_keeps_top3_event_id():
    raw = {
        "normal": {
            "top3": [
                {
                    "title": "Hello",
                    "url": "https://a/",
                    "what_happened": "x",
                    "why_important": "",
                    "what_it_means_for_you": "",
                    "attention_level": "3",
                    "event_id": "55",
                    "related_event_ids": ["55", "56"],
                    "source_urls": ["https://a/"],
                }
            ]
        }
    }
    p = ensure_payload_v3(raw)
    row = p["normal"]["top3"][0]
    assert row.get("event_id") == "55"
    assert row["related_event_ids"][0] == "55"
