"""SEO discovery endpoints must support crawler preflight methods."""

from __future__ import annotations

import pytest


@pytest.fixture
def client():
    pytest.importorskip("fastapi")
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    import app.models  # noqa: F401
    from app.database import Base, get_db
    from app.main import app

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

    app.dependency_overrides[get_db] = _override_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
        sess.close()
        engine.dispose()


def test_sitemap_head_is_crawlable(client):
    r = client.head("/sitemap.xml")

    assert r.status_code == 200
    assert r.text == ""
    assert "application/xml" in r.headers.get("content-type", "")
    assert int(r.headers.get("content-length", "0")) > 0


def test_robots_head_is_crawlable(client):
    r = client.head("/robots.txt")

    assert r.status_code == 200
    assert r.text == ""
    assert "text/plain" in r.headers.get("content-type", "")
    assert int(r.headers.get("content-length", "0")) > 0


def test_sitemap_head_length_matches_get(client):
    get_r = client.get("/sitemap.xml")
    head_r = client.head("/sitemap.xml")

    assert get_r.status_code == 200
    assert head_r.status_code == 200
    assert head_r.headers.get("content-length") == get_r.headers.get("content-length")
