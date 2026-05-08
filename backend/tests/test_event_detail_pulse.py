"""事件详情与榜单 pulse_score 语义一致（不依赖真实数据库）。"""

import json

import pytest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.ranking_score import effective_ranking_score, stable_pulse_score_for_global_event


def test_case1_pulse_stable_when_stored_ranking_differs():
    """score_breakdown 四维固定时 pulse 稳定；存库 ranking_score 可因 freshness 更低。"""
    sb = {
        "trust": 80.0,
        "heat": 70.0,
        "source_mix": 70.0,
        "user_value": 70.0,
        "freshness": 22.0,
    }
    ge = SimpleNamespace(
        metrics_json=json.dumps({"score_breakdown": sb}),
        trust_score=80.0,
        heat_score=500,
        source_count=3,
        user_value_score=70.0,
        ranking_score=52.3,
    )
    pulse = stable_pulse_score_for_global_event(ge)
    expected = (0.30 * 80 + 0.20 * 70 + 0.15 * 70 + 0.10 * 70) / 0.75
    assert abs(pulse - expected) < 1e-6
    assert pulse > float(ge.ranking_score)


def test_case1_effective_can_differ_from_pulse():
    now = datetime.now(timezone.utc)
    pub = datetime(2020, 1, 1, tzinfo=timezone.utc)
    pulse = 88.5
    eff = effective_ranking_score(pulse, pub, "7d", now=now)
    assert eff <= pulse


def test_detail_response_shape_matches_rankings_pulse(monkeypatch):
    """详情路由返回的 pulse 与 stable_pulse_score 一致（mock DB）；需安装 fastapi。"""
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    sb = {
        "trust": 75.0,
        "heat": 75.0,
        "source_mix": 75.0,
        "user_value": 75.0,
        "freshness": 40.0,
    }
    ge = SimpleNamespace(
        id=99,
        status="active",
        stable_key="k99",
        canonical_title="t",
        title_zh="",
        canonical_url="https://x.test",
        summary="",
        category="model",
        source_type="rss",
        published_at=datetime.now(timezone.utc),
        first_seen_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
        source_count=2,
        heat_score=100,
        freshness_score=40.0,
        trust_score=75.0,
        user_value_score=75.0,
        trend_score=50.0,
        weekly_score=0.0,
        ranking_score=48.0,
        action_suggestion="先观望",
        what_happened="",
        why_important="",
        what_it_means_for_you="",
        sources_json="[]",
        metrics_json=json.dumps({"score_breakdown": sb}),
        capability_tags_json="{}",
    )

    class _FakeScalars:
        def all(self):
            return []

    class _FakeSession:
        def get(self, _model, eid):
            return ge if eid == 99 else None

        def scalars(self, _stmt):
            return _FakeScalars()

    def _fake_db():
        yield _FakeSession()

    import app.routers.rankings_public as rp
    from app.database import get_db
    from app.main import app

    monkeypatch.setattr(rp, "build_deduped_sources_for_api", lambda _db, _g: [])

    app.dependency_overrides[get_db] = _fake_db
    try:
        client = TestClient(app)
        r = client.get("/api/events/99")
        assert r.status_code == 200
        body = r.json()
        pulse = body["pulse_score"]
        assert pulse == body["ranking_score"]
        assert body["stored_ranking_score"] == 48.0
        exp = stable_pulse_score_for_global_event(ge)
        assert abs(float(pulse) - exp) < 0.02
        assert "effective_ranking_score" in body
    finally:
        app.dependency_overrides.pop(get_db, None)
