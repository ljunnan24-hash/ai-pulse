"""行业细分标签规则测试。"""

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


def test_non_industry_category_returns_empty_tags():
    ge = SimpleNamespace(
        category="model",
        canonical_title="test",
        title_zh="",
        summary="教育",
        sources_json="[]",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
    )
    assert infer_industry_tags_for_global_event(ge, {}) == []


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
