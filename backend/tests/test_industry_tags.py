"""领域 / 场景标签（industry_tags）规则测试。"""

import json
from types import SimpleNamespace

from app.services.industry_tags import infer_industry_tags, infer_industry_tags_for_global_event


def test_education_keyword_maps_tag():
    blob = "某在线教育平台发布 AI 助教功能"
    tags = infer_industry_tags(blob)
    slugs = {t["slug"] for t in tags}
    assert "education" in slugs
    assert any(t["label"] == "教育" for t in tags if t["slug"] == "education")


def test_healthcare_english_keyword():
    blob = "Healthcare startup raises funding for clinical trials"
    tags = infer_industry_tags(blob)
    assert any(t["slug"] == "healthcare" for t in tags)


def test_ecommerce_shopify_amazon():
    blob = "Shopify announces new AI tools for merchants on Amazon"
    tags = infer_industry_tags(blob)
    slugs = {t["slug"] for t in tags}
    assert "ecommerce" in slugs


def test_empty_blob_returns_empty():
    assert infer_industry_tags("") == []
    assert infer_industry_tags("   ") == []


def test_tool_category_shopify_ecommerce_tags():
    """非 industry：tool + 电商关键词 → ecommerce"""
    ge = SimpleNamespace(
        category="tool",
        canonical_title="Shopify merchant AI assistant for stores",
        title_zh="",
        summary="跨境电商卖家工具",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    tags = infer_industry_tags_for_global_event(ge, {})
    slugs = {t["slug"] for t in tags}
    assert "ecommerce" in slugs


def test_model_category_developer_tools_tags():
    """model + API / coding / developer"""
    ge = SimpleNamespace(
        category="model",
        canonical_title="New coding API for developers with SDK",
        title_zh="",
        summary="",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    tags = infer_industry_tags_for_global_event(ge, {})
    slugs = {t["slug"] for t in tags}
    assert "developer_tools" in slugs


def test_open_source_github_benchmark_tags():
    """open_source：GitHub / benchmark → developer_tools 或 research"""
    ge = SimpleNamespace(
        category="open_source",
        canonical_title="Open weights on GitHub with new benchmark suite",
        title_zh="",
        summary="",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    tags = infer_industry_tags_for_global_event(ge, {})
    slugs = {t["slug"] for t in tags}
    assert "developer_tools" in slugs or "research" in slugs


def test_industry_category_with_education_text():
    ge = SimpleNamespace(
        category="industry",
        canonical_title="AI 教育应用盘点",
        title_zh="",
        summary="",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    tags = infer_industry_tags_for_global_event(ge, {"one_liner": "教培机构探索新产品"})
    slugs = {t["slug"] for t in tags}
    assert "education" in slugs


def test_industry_medical_tags():
    ge = SimpleNamespace(
        category="industry",
        canonical_title="医院引入 AI 诊断辅助系统",
        title_zh="",
        summary="",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    tags = infer_industry_tags_for_global_event(ge, {})
    assert any(t["slug"] == "healthcare" for t in tags)


def test_sources_json_titles_contribute():
    ge = SimpleNamespace(
        category="industry",
        canonical_title="x",
        title_zh="",
        summary="",
        sources_json=json.dumps([{"title": "Hospital adopts AI diagnostics", "source": "Reuters"}]),
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    tags = infer_industry_tags_for_global_event(ge, {})
    assert any(t["slug"] == "healthcare" for t in tags)


def test_no_keyword_returns_empty():
    ge = SimpleNamespace(
        category="tool",
        canonical_title="aaa",
        title_zh="bbb",
        summary="ccc",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    assert infer_industry_tags_for_global_event(ge, {}) == []


def test_infer_ignores_stale_industry_tags_in_metrics():
    """推断时应忽略 metrics 内旧 industry_tags，避免自引用误命中。"""
    ge = SimpleNamespace(
        category="model",
        canonical_title="unrelated generic announcement",
        title_zh="",
        summary="",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    stale = {"one_liner": "x", "industry_tags": [{"slug": "education", "label": "教育"}]}
    tags = infer_industry_tags_for_global_event(ge, stale)
    slugs = {t["slug"] for t in tags}
    assert "education" not in slugs
