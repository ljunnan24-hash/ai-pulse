"""Settings：Phase 2.5 / Phase 3 字段存在且能从 .env 读取（与 get_settings 缓存无关）。"""

from __future__ import annotations

import textwrap

import pytest

from app.config import Settings, get_settings


def test_split_urls_strips_double_scheme() -> None:
    raw = "https://https://www.qbitai.com/feed,https://example.com/atom"
    out = Settings._split_urls(raw)
    assert out[0] == "https://www.qbitai.com/feed"
    assert out[1] == "https://example.com/atom"


def test_weekly_source_defaults_to_global_events() -> None:
    s = Settings(
        database_url="mysql+pymysql://u:p@127.0.0.1:3306/t?charset=utf8mb4",
        doubao_api_key="",
        doubao_model="ep-test",
    )
    assert s.weekly_source == "global_events"


def test_settings_model_declares_phase_fields() -> None:
    names = Settings.model_fields.keys()
    assert "ranking_insight_enabled" in names
    assert "ranking_insight_limit" in names
    assert "ranking_insight_batch_size" in names
    assert "ranking_insight_timeout_seconds" in names
    assert "weekly_source" in names
    assert "global_events_lookback_days" in names
    assert "global_events_min_candidates" in names
    assert "global_events_fallback_lookback_days" in names
    assert "global_events_pool_limit" in names


def test_settings_loads_ranking_and_weekly_from_dotenv(tmp_path, monkeypatch) -> None:
    """在独立目录下放 .env，验证大写环境键映射到 camel/snake 字段。"""
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text(
        textwrap.dedent(
            """
            DATABASE_URL=mysql+pymysql://u:p@127.0.0.1:3306/t?charset=utf8mb4
            RANKING_INSIGHT_ENABLED=true
            RANKING_INSIGHT_LIMIT=31
            RANKING_INSIGHT_BATCH_SIZE=9
            WEEKLY_SOURCE=global_events
            GLOBAL_EVENTS_LOOKBACK_DAYS=7
            GLOBAL_EVENTS_MIN_CANDIDATES=10
            GLOBAL_EVENTS_FALLBACK_LOOKBACK_DAYS=15
            GLOBAL_EVENTS_POOL_LIMIT=39
            DOUBAO_API_KEY=
            DOUBAO_MODEL=ep-test
            """
        ).strip(),
        encoding="utf-8",
    )
    s = Settings()
    assert s.ranking_insight_enabled is True
    assert s.ranking_insight_limit == 31
    assert s.ranking_insight_batch_size == 9
    assert s.weekly_source == "global_events"
    assert s.global_events_lookback_days == 7
    assert s.global_events_min_candidates == 10
    assert s.global_events_fallback_lookback_days == 15
    assert s.global_events_pool_limit == 39


def test_get_settings_returns_same_instance_when_cached(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text(
        "DATABASE_URL=mysql+pymysql://u:p@127.0.0.1:3306/t?charset=utf8mb4\n"
        "RANKING_INSIGHT_ENABLED=false\n",
        encoding="utf-8",
    )
    get_settings.cache_clear()
    a = get_settings()
    b = get_settings()
    assert a is b
    assert hasattr(a, "ranking_insight_enabled")
    assert a.ranking_insight_enabled is False
