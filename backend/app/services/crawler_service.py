from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

import feedparser
import httpx

from app.config import get_settings


def _heat_from_entry(entry: dict[str, Any], idx: int) -> int:
    # 无统一热度字段：用条目顺序 + 时间衰减的简单分数
    base = max(1000 - idx * 10, 0)
    return base


def _parse_dt(entry: dict[str, Any]) -> datetime | None:
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            try:
                return datetime(*t[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                pass
    return None


def fetch_feed_items(feed_url: str, limit_per_feed: int = 15) -> list[dict[str, Any]]:
    settings = get_settings()
    headers = {
        "User-Agent": "AI-Pulse-Bot/1.0 (+https://example.com)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
    }
    out: list[dict[str, Any]] = []
    try:
        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            r = client.get(feed_url, headers=headers)
            r.raise_for_status()
            parsed = feedparser.parse(r.content)
    except Exception:
        try:
            parsed = feedparser.parse(feed_url)
        except Exception:
            return out

    source = feed_url
    for idx, entry in enumerate(getattr(parsed, "entries", [])[:limit_per_feed]):
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or "").strip()
        summary = (entry.get("summary") or entry.get("description") or "").strip()
        if not title and not link:
            continue
        published_at = _parse_dt(entry)
        out.append(
            {
                "source": source,
                "title": title[:500],
                "summary": summary[:4000],
                "link": link[:1000],
                "published_at": published_at,
                "heat_score": _heat_from_entry(entry, idx),
            }
        )
    return out


def collect_all_feed_items() -> list[dict[str, Any]]:
    settings = get_settings()
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    for url in settings.feed_list:
        for item in fetch_feed_items(url):
            key = hashlib.sha256(f"{item['link']}|{item['title']}".encode("utf-8")).hexdigest()
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)
    merged.sort(key=lambda x: x.get("heat_score") or 0, reverse=True)
    return merged[:80]
