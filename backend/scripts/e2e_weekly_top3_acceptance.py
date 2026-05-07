"""
端到端验收（本地无 DB）：select_top3 → apply_locked_top3_merge → apply_locked_top3_merge_judgments
→ sync_legacy_top3_from_judgments → finalize_payload_v3，打印 normal.top3_judgments 前三条。
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# 保证可从 backend 根目录运行：python scripts/e2e_weekly_top3_acceptance.py
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.payload_schema import finalize_payload_v3  # noqa: E402
from app.services.phase35_compat import (  # noqa: E402
    apply_locked_top3_merge_judgments,
    sync_legacy_top3_from_judgments,
)
from app.services.top3_selector import apply_locked_top3_merge, select_top3  # noqa: E402


def _assert_related_first_equals_event_id(label: str, row: dict, *, idx: int | None = None) -> None:
    """有 related_event_ids 时必须有 event_id，且 [0] == event_id。"""
    rel = row.get("related_event_ids")
    if not isinstance(rel, list) or len(rel) == 0:
        return
    eid = str(row.get("event_id") or "").strip()
    suffix = f"[{idx}]" if idx is not None else ""
    assert eid, f"{label}{suffix}: 存在 related_event_ids 时必须同时有 event_id"
    assert str(rel[0]).strip() == eid, f"{label}{suffix}: related_event_ids[0]={rel[0]!r} 应等于 event_id={eid!r}"


def _assert_no_phantom_event_link(row: dict, *, label: str, idx: int | None = None) -> None:
    """无 event_id 时不应出现可误解为站内的 undefined / 空 id。"""
    eid = str(row.get("event_id") or "").strip()
    if eid:
        assert "undefined" not in eid.lower(), f"{label}: event_id 非法: {eid!r}"
        assert eid != "NaN", f"{label}: event_id 非法"
    suffix = f"[{idx}]" if idx is not None else ""
    blob = json.dumps(row, ensure_ascii=False)
    assert "undefined" not in blob.lower(), f"{label}{suffix}: payload 片段不应含 undefined（避免前端拼 /events/undefined）"


def _ev(
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


def main() -> None:
    events = [
        _ev(
            eid="e_gpt1",
            title="GPT-5.5 Instant: smarter, clearer, and more personalized",
            url_suffix="gpt1",
            user_value_score=90,
        ),
        _ev(
            eid="e_gpt2",
            title="OpenAI releases GPT-5.5 Instant, a new default model for ChatGPT",
            url_suffix="gpt2",
            user_value_score=88,
        ),
        _ev(
            eid="e_gpt3",
            title="OpenAI claims ChatGPT's new default model hallucinates way less",
            url_suffix="gpt3",
            user_value_score=87,
        ),
        _ev(
            eid="e_aws",
            title="AWS expands Bedrock agent workflow tools",
            url_suffix="aws",
            category="tool_product",
            user_value_score=80,
            _text_blob="Amazon Bedrock agents workflow expansion enterprise",
        ),
        _ev(
            eid="e_meta",
            title="Meta faces copyright lawsuit over AI training data",
            url_suffix="meta",
            category="industry",
            user_value_score=78,
            _text_blob="copyright lawsuit training data policy",
        ),
    ]

    locked = select_top3(events)
    assert len(locked) == 3

    # 模拟 Composer：中文标题 + Phase 3.5 judgment 正文；locked 仍为英文 canonical
    payload: dict = {
        "allow_short_top3": False,
        "simple": {"lines": [], "footer": ""},
        "normal": {
            "weekly_thesis": {"headline": "本期焦点", "summary": "摘要占位。"},
            "top3_judgments": [
                {
                    "title": "OpenAI 默认模型升级：更少幻觉",
                    "what_happened": "OpenAI 将 ChatGPT 默认模型切换为 GPT-5.5 Instant，强调幻觉率下降与响应质量提升。",
                    "why_it_matters": "直接影响日常对话与插件生态体验。",
                    "who_should_care": "重度 ChatGPT 用户",
                    "what_to_do_now": "在 ChatGPT 设置中确认默认模型版本并试用长对话场景。",
                    "action_level": "现在试用",
                    "source_urls": [],
                    "related_event_ids": [],
                    "related_stable_keys": [],
                },
                {
                    "title": "AWS Bedrock 扩展 Agent 工具链",
                    "what_happened": "AWS 扩展 Bedrock 上的 Agent 与工作流编排能力。",
                    "why_it_matters": "企业可将更多业务流程接到托管 Agent。",
                    "who_should_care": "云上架构师",
                    "what_to_do_now": "评估现有工作流是否可迁移到 Bedrock Agent。",
                    "action_level": "先观望",
                    "source_urls": [],
                    "related_event_ids": [],
                    "related_stable_keys": [],
                },
                {
                    "title": "Meta 训练数据版权诉讼进展",
                    "what_happened": "Meta 面临与 AI 训练数据相关的版权争议。",
                    "why_it_matters": "可能影响后续开源与合规策略。",
                    "who_should_care": "关注合规的从业者",
                    "what_to_do_now": "跟踪案件进展，审视自有数据使用条款。",
                    "action_level": "先观望",
                    "source_urls": [],
                    "related_event_ids": [],
                    "related_stable_keys": [],
                },
            ],
            "top3": [
                {"title": "p", "url": "", "what_happened": "", "why_important": "", "what_it_means_for_you": "", "attention_level": "3"},
                {"title": "p", "url": "", "what_happened": "", "why_important": "", "what_it_means_for_you": "", "attention_level": "3"},
                {"title": "p", "url": "", "what_happened": "", "why_important": "", "what_it_means_for_you": "", "attention_level": "3"},
            ],
            "sections": [],
            "capabilities": [],
            "tools": [],
        },
        "glossary": [],
    }

    apply_locked_top3_merge(payload, locked)
    norm = payload["normal"]
    apply_locked_top3_merge_judgments(norm, locked)
    sync_legacy_top3_from_judgments(norm)

    fin = finalize_payload_v3(payload)
    norm_fin = fin.get("normal") or {}
    tj = norm_fin.get("top3_judgments") or []
    top3_fin = norm_fin.get("top3") or []

    print("=== normal.top3_judgments（前 3 条完整节选）===")
    for i, row in enumerate(tj[:3]):
        print(f"--- [{i}] ---")
        print(json.dumps(row, ensure_ascii=False, indent=2))

    # 断言摘要（验收脚本自检）
    assert len(tj) <= 5
    j0 = tj[0]
    t0 = str(j0.get("title") or "")
    assert "默认模型" in t0 or "幻觉" in t0, f"期望保留 Composer 中文标题，实际: {t0!r}"
    su = j0.get("source_urls") or []
    assert len(su) >= 3, "合并稿应有多来源 URL"
    re = j0.get("related_event_ids") or []
    assert len(re) >= 2, "应包含合并进来的 event_id"

    # —— Top3 站内跳转协议（event_id / related_event_ids / source_urls）——
    eid_j0 = str(j0.get("event_id") or "").strip()
    assert eid_j0, "normal.top3_judgments[0].event_id 必须存在（finalize 后）"
    assert isinstance(re, list) and len(re) >= 1, "normal.top3_judgments[0].related_event_ids 不能为空"
    assert str(re[0]).strip() == eid_j0, "normal.top3_judgments[0].related_event_ids[0] 必须等于 event_id"

    primary_url_top = str(top3_fin[0].get("url") or "").strip() if top3_fin else ""
    assert primary_url_top, "normal.top3[0].url 为主链接，用于校验 source_urls[0]"
    assert isinstance(su, list) and len(su) >= 1
    assert str(su[0]).strip() == primary_url_top, (
        "normal.top3_judgments[0].source_urls[0] 必须等于 normal.top3[0].url（主 URL 在前）"
    )

    eid_t0 = str(top3_fin[0].get("event_id") or "").strip()
    assert eid_t0, "normal.top3[0].event_id 必须存在"
    rel_t0 = top3_fin[0].get("related_event_ids") or []
    assert isinstance(rel_t0, list) and len(rel_t0) >= 1
    assert str(rel_t0[0]).strip() == eid_t0, "normal.top3[0].related_event_ids[0] 必须等于 event_id"

    for i, row in enumerate(tj):
        _assert_related_first_equals_event_id("top3_judgments", row, idx=i)
        _assert_no_phantom_event_link(row, label="top3_judgments", idx=i)
    for i, row in enumerate(top3_fin):
        _assert_related_first_equals_event_id("normal.top3", row, idx=i)
        _assert_no_phantom_event_link(row, label="normal.top3", idx=i)

    print("\n=== Top3 跳转协议抽样 ===")
    print(f"top3_judgments[0].event_id = {j0.get('event_id')!r}")
    print(f"top3_judgments[0].related_event_ids[:4] = {(j0.get('related_event_ids') or [])[:4]!r}")
    print(f"top3_judgments[0].source_urls[:3] = {(j0.get('source_urls') or [])[:3]!r}")
    print(f"normal.top3[0].event_id = {top3_fin[0].get('event_id')!r}")
    print(f"normal.top3[0].url = {primary_url_top!r}")


if __name__ == "__main__":
    main()
