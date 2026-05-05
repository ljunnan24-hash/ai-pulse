"""weekly_quality_v2 审计逻辑。"""

from __future__ import annotations

from app.services.phase35_compat import compute_weekly_quality_v2_audit


def test_weekly_quality_v2_flags_missing_thesis():
    payload = {
        "normal": {
            "top3_judgments": [
                {
                    "title": "a",
                    "what_happened": "w",
                    "why_it_matters": "w",
                    "who_should_care": "w",
                    "what_to_do_now": "做",
                    "action_level": "先观望",
                },
                {
                    "title": "b",
                    "what_happened": "w",
                    "why_it_matters": "w",
                    "who_should_care": "w",
                    "what_to_do_now": "做",
                    "action_level": "先观望",
                },
                {
                    "title": "c",
                    "what_happened": "w",
                    "why_it_matters": "w",
                    "who_should_care": "w",
                    "what_to_do_now": "做",
                    "action_level": "先观望",
                },
            ],
            "capability_boundaries": [{"question": "Q", "conclusion": "能"}],
            "noise_to_ignore": [
                {"name": "n1", "why_not_important": "x", "recommendation": "可以忽略"},
                {"name": "n2", "why_not_important": "y", "recommendation": "可以忽略"},
            ],
        },
        "glossary": [{"term": f"t{i}", "explain": "e"} for i in range(6)],
    }
    out = compute_weekly_quality_v2_audit(payload)
    assert out["weekly_quality_v2"]["has_weekly_thesis"] is False
    assert "缺少 weekly_thesis" in out["weekly_quality_v2_warnings"]


def test_weekly_quality_v2_glossary_over_10_warning():
    payload = {
        "normal": {},
        "glossary": [{"term": f"t{i}", "explain": "e"} for i in range(11)],
    }
    out = compute_weekly_quality_v2_audit(payload)
    assert "术语超过 10 条" in out["weekly_quality_v2_warnings"]
