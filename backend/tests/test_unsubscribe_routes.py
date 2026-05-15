"""邮件退订：GET/POST 均须可用（RFC 8058 一键退订）；无效 token 不得假装成功。"""

import pytest


@pytest.fixture
def client(monkeypatch):
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from app.database import get_db
    from app.main import app
    from app.routers import api as api_router

    def _fake_db():
        yield None

    app.dependency_overrides[get_db] = _fake_db
    tc = TestClient(app)
    yield tc, monkeypatch, api_router
    app.dependency_overrides.pop(get_db, None)


def test_unsubscribe_get_invalid_token_redirect(client):
    tc, monkeypatch, api_router = client
    monkeypatch.setattr(api_router, "_perform_unsubscribe", lambda _db, t: False)
    r = tc.get("/api/unsubscribe?token=nope", follow_redirects=False)
    assert r.status_code == 302
    assert "error=invalid_token" in (r.headers.get("location") or "")


def test_unsubscribe_get_ok_redirect(client):
    tc, monkeypatch, api_router = client
    monkeypatch.setattr(api_router, "_perform_unsubscribe", lambda _db, t: True)
    r = tc.get("/api/unsubscribe?token=ok", follow_redirects=False)
    assert r.status_code == 302
    assert "unsubscribed=1" in (r.headers.get("location") or "")


def test_unsubscribe_post_one_click_ok(client):
    """Gmail 等会对 List-Unsubscribe URL 发 POST，不能 405。"""
    tc, monkeypatch, api_router = client
    monkeypatch.setattr(api_router, "_perform_unsubscribe", lambda _db, t: True)
    r = tc.post(
        "/api/unsubscribe?token=ok",
        data={"List-Unsubscribe": "One-Click"},
        follow_redirects=False,
    )
    assert r.status_code == 302
    assert "unsubscribed=1" in (r.headers.get("location") or "")


def test_unsubscribe_post_empty_body_ok(client):
    tc, monkeypatch, api_router = client
    monkeypatch.setattr(api_router, "_perform_unsubscribe", lambda _db, t: True)
    r = tc.post("/api/unsubscribe?token=ok", follow_redirects=False)
    assert r.status_code == 302
