from __future__ import annotations

import pytest


@pytest.fixture
def analytics_client():
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    import app.models  # noqa: F401
    from app.database import Base, get_db
    from app.main import app
    from app.routers.admin import require_admin

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    sess = Session()

    def _override_db():
        yield sess

    def _override_admin():
        return {"sub": "1", "typ": "admin"}

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[require_admin] = _override_admin
    try:
        yield TestClient(app), sess
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(require_admin, None)
        sess.close()
        engine.dispose()


def test_ranking_events_are_recorded_and_aggregated(analytics_client):
    client, _sess = analytics_client

    payload = {
        "visitor_id": "visitor-123456",
        "session_id": "session-123456",
        "events": [
            {
                "action": "impression",
                "event_id": 42,
                "event_key": "42",
                "surface": "rankings_table",
                "range_key": "7d",
                "rank_position": 2,
                "category": "model",
                "title": "一个重要 AI 事件",
                "source_label": "OpenAI",
                "source_type": "official",
                "path": "/rankings?range=7d",
                "target_url": "/events/42",
            },
            {
                "action": "click",
                "event_id": 42,
                "event_key": "42",
                "surface": "rankings_table",
                "range_key": "7d",
                "rank_position": 2,
                "category": "model",
                "title": "一个重要 AI 事件",
                "source_label": "OpenAI",
                "source_type": "official",
                "path": "/rankings?range=7d",
                "target_url": "/events/42",
            },
        ],
    }

    r = client.post("/api/analytics/ranking-events", json=payload)
    assert r.status_code == 200
    assert r.json()["inserted"] == 2

    agg = client.get("/api/admin/analytics/ranking-interest?days=7&limit=5")
    assert agg.status_code == 200
    body = agg.json()
    assert body["top_events"][0]["event_id"] == 42
    assert body["top_events"][0]["clicks"] == 1
    assert body["top_events"][0]["impressions"] == 1
    assert body["top_events"][0]["ctr"] == 100.0
    assert body["top_sources"][0]["source_label"] == "OpenAI"
