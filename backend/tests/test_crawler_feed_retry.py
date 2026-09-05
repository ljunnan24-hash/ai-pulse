from __future__ import annotations

import httpx

from app.services import crawler_service


ATOM_BODY = b"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <entry>
    <title>Retry success</title>
    <link href="https://example.com/retry-success" />
    <updated>2026-06-24T00:00:00Z</updated>
    <summary>One useful item.</summary>
  </entry>
</feed>
"""


class _FakeResponse:
    def __init__(self, status_code: int, *, headers: dict[str, str] | None = None, content: bytes = b"") -> None:
        self.status_code = status_code
        self.headers = headers or {}
        self.content = content

    def raise_for_status(self) -> None:
        if self.status_code < 400:
            return
        req = httpx.Request("GET", "https://example.com/feed")
        resp = httpx.Response(self.status_code, request=req, headers=self.headers, content=self.content)
        raise httpx.HTTPStatusError(f"HTTP {self.status_code}", request=req, response=resp)


def _patch_client(monkeypatch, responses: list[_FakeResponse], calls: list[str]) -> None:
    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args) -> None:
            return None

        def get(self, url: str, headers: dict[str, str]):
            calls.append(url)
            return responses.pop(0)

    monkeypatch.setattr(crawler_service.httpx, "Client", FakeClient)


def test_feed_fetch_retries_rate_limit_and_succeeds(monkeypatch) -> None:
    calls: list[str] = []
    sleeps: list[float] = []
    responses = [
        _FakeResponse(429, headers={"retry-after": "0"}, content=b"rate limited"),
        _FakeResponse(200, headers={"content-type": "application/atom+xml"}, content=ATOM_BODY),
    ]
    _patch_client(monkeypatch, responses, calls)
    monkeypatch.setattr(crawler_service.time, "sleep", lambda seconds: sleeps.append(seconds))

    items, report = crawler_service.fetch_feed_items_with_report("https://www.reddit.com/r/OpenAI/top/.rss?t=week")

    assert len(calls) == 2
    assert sleeps == [0.0]
    assert report.health_status == "ok"
    assert report.http_status == 200
    assert report.raw_entry_count == 1
    assert items[0]["title"] == "Retry success"


def test_feed_fetch_does_not_retry_forbidden_challenge(monkeypatch) -> None:
    calls: list[str] = []
    responses = [
        _FakeResponse(
            403,
            headers={"content-type": "text/html; charset=UTF-8"},
            content=b"<!DOCTYPE html><title>Just a moment...</title>",
        )
    ]
    _patch_client(monkeypatch, responses, calls)
    def fail_if_feedparser_fetches_url(_url):
        raise AssertionError("feedparser must not perform an unbounded URL fetch")

    monkeypatch.setattr(crawler_service.feedparser, "parse", fail_if_feedparser_fetches_url)

    items, report = crawler_service.fetch_feed_items_with_report("https://blogs.microsoft.com/ai/feed/")

    assert items == []
    assert len(calls) == 1
    assert report.health_status == "fetch_failed"
    assert report.http_status == 403
    assert report.error_class == "HTTPStatusError"
    assert "HTTPStatusError after 1 attempt" in (report.error_message or "")
