"""SEO discovery endpoints must support crawler preflight methods."""

from __future__ import annotations

import pytest


@pytest.fixture
def client():
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient

    from app.main import app

    yield TestClient(app)


def test_sitemap_head_is_crawlable(client):
    r = client.head("/sitemap.xml")

    assert r.status_code == 200
    assert r.text == ""
    assert "application/xml" in r.headers.get("content-type", "")


def test_robots_head_is_crawlable(client):
    r = client.head("/robots.txt")

    assert r.status_code == 200
    assert r.text == ""
    assert "text/plain" in r.headers.get("content-type", "")
