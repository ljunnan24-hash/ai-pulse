"""进程内滑动窗口限流单元测试。"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services import site_identity as si


@pytest.fixture(autouse=True)
def _clear_windows() -> None:
    si._windows.clear()
    yield
    si._windows.clear()


def test_allow_sliding_blocks_after_max() -> None:
    for _ in range(3):
        assert si.allow_sliding("k1", bucket="t", max_events=3, window_sec=60.0)
    assert not si.allow_sliding("k1", bucket="t", max_events=3, window_sec=60.0)


def test_buckets_are_isolated() -> None:
    for _ in range(2):
        assert si.allow_sliding("k", bucket="a", max_events=2, window_sec=60.0)
    assert not si.allow_sliding("k", bucket="a", max_events=2, window_sec=60.0)
    assert si.allow_sliding("k", bucket="b", max_events=2, window_sec=60.0)


def test_enforce_sliding_limit_raises_429() -> None:
    for _ in range(2):
        si.enforce_sliding_limit("x", bucket="t", max_events=2, window_sec=60.0)
    with pytest.raises(HTTPException) as exc:
        si.enforce_sliding_limit("x", bucket="t", max_events=2, window_sec=60.0)
    assert exc.value.status_code == 429
