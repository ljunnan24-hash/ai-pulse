"""Phase 3.5 payload：新字段清洗与旧字段映射。"""

from __future__ import annotations

from app.services.payload_schema import ensure_payload_v3, finalize_payload_v3, validate_payload
from app.services.phase35_compat import (
    extract_clean_phase35_normal,
    map_category_recap_to_sections,
    map_capability_boundaries_to_capabilities,
    map_tools_to_try_to_legacy_tools,
    map_top3_judgments_to_top3,
)


def test_payload_schema_accepts_weekly_thesis():
    raw = {
        "normal": {
            "top3": [
                {
                    "title": "a",
                    "url": "https://a",
                    "what_happened": "x",
                    "why_important": "y",
                    "what_it_means_for_you": "z",
                    "attention_level": "3",
                },
                {
                    "title": "b",
                    "url": "https://b",
                    "what_happened": "x",
                    "why_important": "y",
                    "what_it_means_for_you": "z",
                    "attention_level": "3",
                },
                {
                    "title": "c",
                    "url": "https://c",
                    "what_happened": "x",
                    "why_important": "y",
                    "what_it_means_for_you": "z",
                    "attention_level": "3",
                },
            ],
            "sections": [
                {"title": "大模型更新", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
                {"title": "工具/产品", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
                {"title": "行业动态", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
            ],
            "capabilities": [{"theme": "q", "can_do": "x", "cannot_do": "y", "cost": "低", "suitable_for": "z", "conclusion": "c"}],
            "tools": [{"name": "n", "can_do": "x", "suitable_for": "y", "worth_trying": "No", "what_it_means_for_you": "z"}],
            "weekly_thesis": {"headline": "主线", "summary": "说明。", "trend_lines": ["t1", "t2"]},
        },
        "simple": {
            "lines": [
                {"title": "l1", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
                {"title": "l2", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
                {"title": "l3", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
            ]
        },
        "glossary": [
            {"term": "a", "explain": "e"},
            {"term": "b", "explain": "e"},
            {"term": "c", "explain": "e"},
            {"term": "d", "explain": "e"},
            {"term": "f", "explain": "e"},
        ],
    }
    p = finalize_payload_v3(raw)
    errs = validate_payload(p)
    assert not errs
    assert p["normal"]["weekly_thesis"]["headline"] == "主线"


def test_top3_judgments_maps_to_legacy_top3():
    j = [
        {
            "title": "判断A",
            "related_event_ids": ["e01"],
            "what_happened": "发生",
            "why_it_matters": "重要",
            "who_should_care": "创始人",
            "what_to_do_now": "先观望一周",
            "action_level": "先观望",
            "pulse_score": 80,
            "source_urls": ["https://x"],
        }
    ]
    legacy = map_top3_judgments_to_top3(j)
    assert legacy[0]["title"] == "判断A"
    assert legacy[0]["attention_level"] == "3"


def test_capability_boundaries_maps_to_capabilities():
    cb = [
        {
            "question": "AI 能否替代初级编码？",
            "conclusion": "能覆盖重复劳动，不能独立交付复杂系统。",
            "can_do": ["脚手架代码"],
            "cannot_do": ["复杂业务建模"],
            "best_for": "小团队",
            "recommendation": "用 AI 生成草稿再人工审",
            "confidence": "中",
            "related_event_ids": [],
        }
    ]
    caps = map_capability_boundaries_to_capabilities(cb)
    assert caps[0]["theme"].startswith("AI")
    assert len(caps[0]["conclusion"]) > 2


def test_tools_to_try_maps_to_tools():
    tt = [
        {
            "name": "ToolX",
            "what_it_does": "生成接口代码",
            "best_for": "后端",
            "barrier": "低",
            "recommendation": "现在试用",
            "related_event_ids": [],
            "url": "https://tool",
        }
    ]
    tools = map_tools_to_try_to_legacy_tools(tt)
    assert tools[0]["worth_trying"] == "Yes"


def test_category_recap_maps_to_three_sections():
    recap = [
        {"category": "大模型更新", "trend": "上下文变长", "representative_events": ["事件A"], "what_to_watch": "定价"},
        {"category": "工具与产品", "trend": "IDE 集成", "representative_events": ["事件B"], "what_to_watch": "插件生态"},
        {"category": "行业动态", "trend": "合规", "representative_events": ["事件C"], "what_to_watch": "监管口径"},
    ]
    secs = map_category_recap_to_sections(recap)
    assert len(secs) == 3


def test_finalize_maps_phase35_to_legacy_fields():
    raw = {
        "simple": {
            "lines": [
                {"title": "l1", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
                {"title": "l2", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
                {"title": "l3", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
            ]
        },
        "normal": {
            "top3": [
                {"title": "a", "url": "https://a", "what_happened": "x", "why_important": "y", "what_it_means_for_you": "z", "attention_level": "3"},
                {"title": "b", "url": "https://b", "what_happened": "x", "why_important": "y", "what_it_means_for_you": "z", "attention_level": "3"},
                {"title": "c", "url": "https://c", "what_happened": "x", "why_important": "y", "what_it_means_for_you": "z", "attention_level": "3"},
            ],
            "capability_boundaries": [
                {
                    "question": "Q1",
                    "conclusion": "能部分替代",
                    "can_do": ["a"],
                    "cannot_do": ["b"],
                    "best_for": "团队",
                    "recommendation": "试点一周",
                    "confidence": "高",
                    "related_event_ids": [],
                }
            ],
            "tools_to_try": [
                {
                    "name": "T1",
                    "what_it_does": "写脚本",
                    "best_for": "个人",
                    "barrier": "低",
                    "recommendation": "现在试用",
                    "related_event_ids": [],
                    "url": "",
                }
            ],
            "category_recap": [
                {"category": "大模型更新", "trend": "t", "representative_events": ["e1"], "what_to_watch": "w"},
                {"category": "工具与产品", "trend": "t", "representative_events": ["e2"], "what_to_watch": "w"},
                {"category": "行业动态", "trend": "t", "representative_events": ["e3"], "what_to_watch": "w"},
            ],
            "sections": [
                {"title": "大模型更新", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
                {"title": "工具/产品", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
                {"title": "行业动态", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
            ],
        },
        "glossary": [{"term": f"t{i}", "explain": "e"} for i in range(5)],
    }
    p = finalize_payload_v3(raw)
    assert p["normal"]["capabilities"][0]["theme"] == "Q1"
    assert p["normal"]["tools"][0]["name"] == "T1"


def test_empty_new_fields_old_top3_still_valid():
    raw = {
        "simple": {
            "lines": [
                {"title": "l1", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
                {"title": "l2", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
                {"title": "l3", "what_happened": "短", "what_it_means_for_you": "x", "url": ""},
            ]
        },
        "normal": {
            "top3": [
                {"title": "a", "url": "https://a", "what_happened": "x", "why_important": "y", "what_it_means_for_you": "z", "attention_level": "3"},
                {"title": "b", "url": "https://b", "what_happened": "x", "why_important": "y", "what_it_means_for_you": "z", "attention_level": "3"},
                {"title": "c", "url": "https://c", "what_happened": "x", "why_important": "y", "what_it_means_for_you": "z", "attention_level": "3"},
            ],
            "sections": [
                {"title": "大模型更新", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
                {"title": "工具/产品", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
                {"title": "行业动态", "items": [{"title": "t", "url": "", "what_happened": "w", "suitable_for": "s", "worth_attention": "Low", "what_it_means_for_you": "m", "see_top3": False}]},
            ],
            "capabilities": [{"theme": "q", "can_do": "x", "cannot_do": "y", "cost": "低", "suitable_for": "z", "conclusion": "c"}],
            "tools": [{"name": "n", "can_do": "x", "suitable_for": "y", "worth_trying": "No", "what_it_means_for_you": "z"}],
        },
        "glossary": [{"term": f"t{i}", "explain": "e"} for i in range(5)],
    }
    p = finalize_payload_v3(raw)
    assert len(p["normal"]["top3"]) == 3
    assert not validate_payload(p)


def test_noise_to_ignore_preserved_in_ensure():
    raw = {
        "normal": {
            "top3": [],
            "noise_to_ignore": [{"name": "噪音1", "why_not_important": "弱相关", "recommendation": "可以忽略", "related_event_ids": []}],
        }
    }
    e = ensure_payload_v3(raw)
    assert len(e["normal"]["noise_to_ignore"]) >= 1


def test_extract_clean_limits_glossary_noise():
    ext = extract_clean_phase35_normal(
        {
            "noise_to_ignore": [
                {"name": "N1", "why_not_important": "x", "recommendation": "可以忽略", "related_event_ids": []},
                {"name": "N2", "why_not_important": "y", "recommendation": "可以忽略", "related_event_ids": []},
            ]
        }
    )
    assert len(ext["noise_to_ignore"]) == 2
