"""ranking_insight：超时配置、payload 截断、batch 失败后单条 fallback。"""

from __future__ import annotations

import json
import re
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.config import Settings, get_settings
from app.services.ranking_insight_service import (
    CAPABILITY_KEYS,
    _build_user_payload,
    enrich_ranking_insights,
)


def _insight_row(eid: int) -> dict:
    caps = {k: 0.1 for k in CAPABILITY_KEYS}
    return {
        "event_id": eid,
        "one_liner": "企业级应用进入可用阶段",
        "what_happened": "事实用于测试",
        "why_important": "行业意义用于测试",
        "what_it_means_for_you": "对读者的影响",
        "action_suggestion": "先观望",
        "user_value_score": 55,
        "capability_tags": caps,
    }


def _fake_ge(eid: int) -> SimpleNamespace:
    return SimpleNamespace(
        id=eid,
        status="active",
        canonical_title=f"标题{eid}",
        summary="摘要" * 400,
        canonical_url="https://example.com/" + "p" * 2000,
        category="application",
        sources_json=json.dumps(
            [{"title": "s" * 300, "url": "u" * 500, "source": "src" * 40} for _ in range(10)]
        ),
        what_happened="",
        why_important="",
        what_it_means_for_you="",
        action_suggestion="",
        user_value_score=0.0,
        capability_tags_json="{}",
        metrics_json="{}",
    )


def test_build_user_payload_truncates_and_caps_sources() -> None:
    ge = _fake_ge(1)
    p = _build_user_payload(ge)
    assert len(p["title"]) <= 300
    assert len(p["summary"]) <= 1200
    assert len(p["canonical_url"]) <= 800
    assert len(p["sources_json"]) <= 5
    for s in p["sources_json"]:
        assert len(s["title"]) <= 200
        assert len(s["url"]) <= 300
        assert len(s["source"]) <= 80


def test_batch_timeout_triggers_single_fallback_and_writes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://u:p@127.0.0.1:3306/t?charset=utf8mb4")
    monkeypatch.setenv("RANKING_INSIGHT_TIMEOUT_SECONDS", "199")
    get_settings.cache_clear()

    class _Client:
        def is_configured(self) -> bool:
            return True

        def complete_json(self, **kwargs):
            assert kwargs.get("timeout_s") == 199.0
            user = kwargs["user"]
            if user.count('"event_id":') >= 2:
                raise httpx.ReadTimeout("simulated batch")
            m = re.search(r'"event_id":\s*(\d+)', user)
            eid = int(m.group(1))
            return {"insights": [_insight_row(eid)]}

    ge1, ge2 = _fake_ge(301), _fake_ge(302)
    db = MagicMock()

    def _get(_entity, pk: int):
        return {301: ge1, 302: ge2}.get(pk)

    db.get.side_effect = _get

    with patch("app.services.ranking_insight_service.LlmJsonClient", return_value=_Client()):
        with patch(
            "app.services.ranking_insight_service._collect_candidate_ids",
            return_value=[301, 302],
        ):
            with patch("app.services.ranking_insight_service.recalculate_global_event"):
                n = enrich_ranking_insights(db, limit=10, force=True)
    assert n == 2
    assert (ge1.what_happened or "").startswith("事实")
    assert (ge2.what_happened or "").startswith("事实")


def test_single_failure_does_not_block_other_event(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://u:p@127.0.0.1:3306/t?charset=utf8mb4")
    get_settings.cache_clear()

    class _Client:
        def is_configured(self) -> bool:
            return True

        def complete_json(self, **kwargs):
            user = kwargs["user"]
            if user.count('"event_id":') >= 2:
                raise httpx.ReadTimeout("batch")
            m = re.search(r'"event_id":\s*(\d+)', user)
            eid = int(m.group(1))
            if eid == 401:
                raise httpx.ReadTimeout("single fail")
            return {"insights": [_insight_row(eid)]}

    ge1, ge2 = _fake_ge(401), _fake_ge(402)
    db = MagicMock()

    def _get(_entity, pk: int):
        return {401: ge1, 402: ge2}.get(pk)

    db.get.side_effect = _get

    with patch("app.services.ranking_insight_service.LlmJsonClient", return_value=_Client()):
        with patch(
            "app.services.ranking_insight_service._collect_candidate_ids",
            return_value=[401, 402],
        ):
            with patch("app.services.ranking_insight_service.recalculate_global_event"):
                n = enrich_ranking_insights(db, limit=10, force=True)
    assert n == 1
    assert not (ge1.what_happened or "").startswith("事实")
    assert (ge2.what_happened or "").startswith("事实")


def test_timeout_seconds_from_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://u:p@127.0.0.1:3306/t?charset=utf8mb4")
    monkeypatch.setenv("RANKING_INSIGHT_TIMEOUT_SECONDS", "211")
    s = Settings()
    assert s.ranking_insight_timeout_seconds == 211.0
