"""今日榜：上海自然日 published_at 窗口，排除仅靠 last_seen 刷新的旧事件。"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest


def test_get_yesterday_window_utc_golden():
    from app.utils.time_windows import get_yesterday_window_utc

    ref = datetime(2026, 5, 15, 10, 0, 0, tzinfo=timezone.utc)
    start_utc, end_utc, target_date = get_yesterday_window_utc("Asia/Shanghai", reference=ref)
    assert target_date == date(2026, 5, 14)
    # 上海 2026-05-14 00:00 = UTC 2026-05-13 16:00；上海 2026-05-15 00:00 = UTC 2026-05-14 16:00
    assert start_utc == datetime(2026, 5, 13, 16, 0, 0, tzinfo=timezone.utc)
    assert end_utc == datetime(2026, 5, 14, 16, 0, 0, tzinfo=timezone.utc)


def test_get_yesterday_window_shanghai_midnight_maps_to_utc_16():
    """与黄金用例一致：无夏令时上海固定 UTC+8，昨天/今天 0 点对齐到 UTC 16:00。"""
    from app.utils.time_windows import get_yesterday_window_utc

    ref = datetime(2026, 5, 15, 10, 0, 0, tzinfo=timezone.utc)
    start_utc, end_utc, _ = get_yesterday_window_utc("Asia/Shanghai", reference=ref)
    assert start_utc.hour == 16 and start_utc.minute == 0
    assert end_utc.hour == 16 and end_utc.minute == 0
    assert (end_utc - start_utc).total_seconds() == 86400


def _require_sa2_orm():
    try:
        from sqlalchemy.orm import DeclarativeBase  # noqa: F401
    except ImportError:
        pytest.skip("SQLAlchemy 2.x required for rankings ORM tests")
    from app.database import Base, get_db
    from app.models import GlobalEvent

    return Base, get_db, GlobalEvent


def _new_global_event(
    GlobalEvent,
    *,
    id: int,
    stable_key: str,
    published_at: datetime | None,
    last_seen_at: datetime,
    ranking_score: float = 80.0,
):
    return GlobalEvent(
        id=id,
        stable_key=stable_key,
        canonical_title="t",
        title_zh="",
        canonical_url="https://example.com/" + stable_key,
        summary="s",
        category="model",
        source_type="rss",
        published_at=published_at,
        first_seen_at=last_seen_at,
        last_seen_at=last_seen_at,
        source_count=1,
        heat_score=10,
        freshness_score=50.0,
        trust_score=50.0,
        user_value_score=50.0,
        trend_score=50.0,
        weekly_score=0.0,
        ranking_score=ranking_score,
        action_suggestion="先观望",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
        status="active",
        sources_json="[]",
        metrics_json="{}",
        capability_tags_json="{}",
    )


@pytest.fixture
def sqlite_rankings_session():
    Base, get_db, GlobalEvent = _require_sa2_orm()
    import app.models  # noqa: F401 — 注册全部表到 Base.metadata

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    sess = Session()
    yield sess, GlobalEvent, get_db
    sess.close()


def test_today_rankings_excludes_old_published_with_recent_last_seen(
    sqlite_rankings_session, monkeypatch
):
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from app.main import app
    import app.routers.rankings_public as rp

    sess, GlobalEvent, get_db = sqlite_rankings_session

    start_utc = datetime(2026, 5, 13, 16, 0, 0, tzinfo=timezone.utc)
    end_utc = datetime(2026, 5, 14, 16, 0, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(
        rp,
        "get_yesterday_window_utc",
        lambda tz_name="Asia/Shanghai": (start_utc, end_utc, date(2026, 5, 14)),
    )

    old_pub = start_utc - timedelta(days=3)
    touch = end_utc + timedelta(hours=2)
    sess.add(
        _new_global_event(
            GlobalEvent,
            id=5001,
            stable_key="sk-old",
            published_at=old_pub,
            last_seen_at=touch,
            ranking_score=99.0,
        )
    )
    sess.commit()

    def _override_db():
        yield sess

    app.dependency_overrides[get_db] = _override_db
    try:
        client = TestClient(app)
        r = client.get("/api/rankings?range=today")
        assert r.status_code == 200
        assert r.json()["items"] == []
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_today_rankings_boundary_left_inclusive_right_exclusive(
    sqlite_rankings_session, monkeypatch
):
    """
    - published_at == 上海昨天 00:00（UTC 窗口左端）→ 应入选（>= start）。
    - published_at == 上海今天 00:00（UTC 窗口右端）→ 不应入选（< end，右开）。
    - published_at 在窗外、last_seen 在窗后 → 不应入选。
    """
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from app.main import app
    import app.routers.rankings_public as rp

    sess, GlobalEvent, get_db = sqlite_rankings_session

    start_utc = datetime(2026, 5, 13, 16, 0, 0, tzinfo=timezone.utc)
    end_utc = datetime(2026, 5, 14, 16, 0, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(
        rp,
        "get_yesterday_window_utc",
        lambda tz_name="Asia/Shanghai": (start_utc, end_utc, date(2026, 5, 14)),
    )

    touch_late = end_utc + timedelta(hours=3)
    ge_left = _new_global_event(
        GlobalEvent,
        id=5101,
        stable_key="sk-bound-left",
        published_at=start_utc,
        last_seen_at=touch_late,
        ranking_score=10.0,
    )
    ge_right = _new_global_event(
        GlobalEvent,
        id=5102,
        stable_key="sk-bound-right",
        published_at=end_utc,
        last_seen_at=touch_late,
        ranking_score=99.0,
    )
    ge_out = _new_global_event(
        GlobalEvent,
        id=5103,
        stable_key="sk-bound-out",
        published_at=start_utc - timedelta(seconds=1),
        last_seen_at=touch_late,
        ranking_score=98.0,
    )
    sess.add_all([ge_left, ge_right, ge_out])
    sess.commit()

    def _override_db():
        yield sess

    app.dependency_overrides[get_db] = _override_db
    try:
        client = TestClient(app)
        r = client.get("/api/rankings?range=today&limit=50")
        assert r.status_code == 200
        ids = {it["id"] for it in r.json()["items"]}
        assert ge_left.id in ids
        assert ge_right.id not in ids
        assert ge_out.id not in ids
        assert len(ids) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_today_rankings_includes_published_inside_shanghai_yesterday_window(
    sqlite_rankings_session, monkeypatch
):
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from app.main import app
    import app.routers.rankings_public as rp

    sess, GlobalEvent, get_db = sqlite_rankings_session

    start_utc = datetime(2026, 5, 13, 16, 0, 0, tzinfo=timezone.utc)
    end_utc = datetime(2026, 5, 14, 16, 0, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(
        rp,
        "get_yesterday_window_utc",
        lambda tz_name="Asia/Shanghai": (start_utc, end_utc, date(2026, 5, 14)),
    )

    in_window_pub = start_utc + timedelta(hours=4)
    touch = end_utc + timedelta(hours=1)
    ge = _new_global_event(
        GlobalEvent,
        id=5002,
        stable_key="sk-in",
        published_at=in_window_pub,
        last_seen_at=touch,
        ranking_score=55.0,
    )
    sess.add(ge)
    sess.commit()

    def _override_db():
        yield sess

    app.dependency_overrides[get_db] = _override_db
    try:
        client = TestClient(app)
        r = client.get("/api/rankings?range=today")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) == 1
        assert items[0]["id"] == ge.id
    finally:
        app.dependency_overrides.pop(get_db, None)
