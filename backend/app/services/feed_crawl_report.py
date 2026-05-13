from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def content_type_implies_feed(content_type: str | None) -> bool:
    if not content_type:
        return False
    c = content_type.lower()
    return any(
        x in c
        for x in (
            "application/rss",
            "application/atom",
            "application/xml",
            "text/xml",
            "/rss+xml",
            "/atom+xml",
        )
    )


def body_looks_like_feed(body: bytes | None) -> bool:
    if not body:
        return False
    head = body[:8192].lstrip()
    low = head.lower()
    if low.startswith(b"<?xml"):
        return True
    if b"<rss" in low or b"<feed" in low:
        return True
    return False


def should_mark_invalid_feed(
    http_status: int | None,
    content_type: str | None,
    body: bytes | None,
) -> bool:
    if http_status is None or http_status < 200 or http_status >= 300:
        return False
    if content_type_implies_feed(content_type):
        return False
    if body_looks_like_feed(body):
        return False
    ct = (content_type or "").lower()
    if "text/html" in ct:
        return True
    if body and (b"<html" in body[:4096].lower() or b"<!doctype html" in body[:4096].lower()):
        return True
    return False


@dataclass
class FeedCrawlReport:
    run_id: str
    job_name: str
    feed_url: str
    feed_channel: str
    http_status: int | None
    content_type: str | None
    fetch_ok: bool
    parse_ok: bool
    raw_entry_count: int
    emitted_item_count: int
    inserted_item_count: int | None
    health_status: str
    error_class: str | None
    error_message: str | None
    duration_ms: int
    run_at: datetime

    def to_row(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "job_name": self.job_name,
            "feed_url": self.feed_url[:2048] if self.feed_url else "",
            "feed_channel": (self.feed_channel or "")[:64],
            "http_status": self.http_status,
            "content_type": (self.content_type or "")[:512] if self.content_type else None,
            "fetch_ok": bool(self.fetch_ok),
            "parse_ok": bool(self.parse_ok),
            "raw_entry_count": int(self.raw_entry_count),
            "emitted_item_count": int(self.emitted_item_count),
            "inserted_item_count": self.inserted_item_count,
            "health_status": (self.health_status or "")[:32],
            "error_class": (self.error_class or "")[:128] if self.error_class else None,
            "error_message": self.error_message,
            "duration_ms": int(self.duration_ms),
            "run_at": self.run_at,
        }


@dataclass
class FeedCrawlTimer:
    start: float = field(default_factory=time.monotonic)

    def elapsed_ms(self) -> int:
        return int((time.monotonic() - self.start) * 1000)


def apply_inserted_counts_and_no_new_health(
    reports: list[FeedCrawlReport],
    final_items: list[dict[str, Any]],
) -> None:
    from collections import Counter

    c: Counter[str] = Counter()
    for it in final_items:
        fu = (it.get("feed_url") or "").strip()
        if fu:
            c[fu] += 1
    gh_n = sum(
        1
        for it in final_items
        if (it.get("source_type") == "github" or not (it.get("feed_url") or "").strip())
    )
    for r in reports:
        if (r.feed_channel or "").lower() == "github" or not (r.feed_url or "").strip():
            r.inserted_item_count = gh_n
        else:
            r.inserted_item_count = c.get((r.feed_url or "").strip(), 0)
        if r.health_status == "ok" and r.emitted_item_count > 0 and (r.inserted_item_count or 0) == 0:
            r.health_status = "no_new_items"
