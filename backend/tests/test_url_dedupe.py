"""RawItem / collect 侧 URL 规范化与入库前去重逻辑。"""

from __future__ import annotations

from sqlalchemy import create_engine, inspect as sa_inspect
from sqlalchemy.orm import sessionmaker

from app.models import Base, RawItem
from app.services.feed_crawl_report import FeedCrawlReport, apply_inserted_counts_and_no_new_health
from app.services.raw_item_dedupe import filter_new_items_for_daily_rankings
from app.utils.url_dedupe import (
    attach_raw_dedupe_fields,
    item_stable_dedupe_key,
    normalize_url_for_dedupe,
    url_dedupe_hash,
)


def test_utm_and_fragment_dedupe_same_hash():
    a = "https://Example.com:443/path/?utm_source=x&b=2&a=1#frag"
    b = "https://example.com/path?a=1&b=2"
    assert normalize_url_for_dedupe(a) == normalize_url_for_dedupe(b)
    assert url_dedupe_hash(a) == url_dedupe_hash(b)


def test_openai_style_same_article_one_hash():
    # 同 path：不同 utm / fragment 应合并
    u1 = "https://openai.com/blog/hello/?utm_medium=email"
    u2 = "https://openai.com/blog/hello#top"
    assert url_dedupe_hash(u1) == url_dedupe_hash(u2)


def test_item_stable_dedupe_key_prefers_url_over_title():
    it = {"link": "https://x.com/a?utm=1", "title": "T"}
    k1 = item_stable_dedupe_key(it)
    it2 = {"link": "https://x.com/a?utm=2", "title": "Other"}
    assert k1 == item_stable_dedupe_key(it2)


def test_no_link_uses_title_hash_in_key():
    it = {"link": "", "title": "  Hello   World  "}
    assert item_stable_dedupe_key(it).startswith("t:")


def test_attach_empty_link_title_does_not_crash():
    it: dict = {"link": "", "title": ""}
    attach_raw_dedupe_fields(it)
    assert it["_normalized_link"] == ""
    assert len(it.get("_normalized_link_hash") or "") == 64


def test_filter_skips_existing_normalized_hash_sqlite():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Sess = sessionmaker(bind=engine)
    db = Sess()
    try:
        insp = sa_inspect(engine)
        assert "normalized_link_hash" in {c["name"] for c in insp.get_columns("raw_items")}
        url = "https://news.example/item?utm=1"
        attach_raw_dedupe_fields({"link": url, "title": "t"})
        nh = {"link": url, "title": "t"}
        attach_raw_dedupe_fields(nh)
        db.add(
            RawItem(
                issue_id=None,
                source_type="rss",
                source="S",
                title="t",
                summary="",
                link=url,
                normalized_link=nh["_normalized_link"] or None,
                normalized_link_hash=nh["_normalized_link_hash"],
                heat_score=0,
                extra_json="{}",
            )
        )
        db.commit()

        incoming = [
            {"link": "https://news.example/item?utm=2", "title": "t", "feed_url": "https://f.example/atom"},
        ]
        out = filter_new_items_for_daily_rankings(db, incoming)
        assert out == []
    finally:
        db.close()


def test_filter_second_pass_empty_after_insert_sqlite():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Sess = sessionmaker(bind=engine)
    db = Sess()
    try:
        url = "https://dup.example/p"
        it = {"link": url, "title": "x", "feed_url": "http://feed/d"}
        attach_raw_dedupe_fields(it)
        first = filter_new_items_for_daily_rankings(db, [it])
        assert len(first) == 1
        db.add(
            RawItem(
                issue_id=None,
                source_type="rss",
                source="S",
                title=first[0]["title"],
                summary="",
                link=first[0]["link"],
                normalized_link=(first[0].get("_normalized_link") or None),
                normalized_link_hash=first[0].get("_normalized_link_hash"),
                heat_score=0,
                extra_json="{}",
            )
        )
        db.commit()
        second = filter_new_items_for_daily_rankings(db, [dict(it)])
        assert second == []
    finally:
        db.close()


def test_inserted_item_count_uses_passed_list():
    from datetime import datetime, timezone

    rep = FeedCrawlReport(
        run_id="r",
        job_name="j",
        feed_url="https://feed/a",
        feed_channel="rss",
        http_status=200,
        content_type="xml",
        fetch_ok=True,
        parse_ok=True,
        raw_entry_count=5,
        emitted_item_count=5,
        inserted_item_count=None,
        health_status="ok",
        error_class=None,
        error_message=None,
        duration_ms=1,
        run_at=datetime.now(timezone.utc),
    )
    reps = [rep]
    final_items = [{"feed_url": "https://feed/a"}, {"feed_url": "https://feed/a"}]
    apply_inserted_counts_and_no_new_health(reps, final_items)
    assert reps[0].inserted_item_count == 2

    apply_inserted_counts_and_no_new_health(reps, [])
    assert reps[0].inserted_item_count == 0

