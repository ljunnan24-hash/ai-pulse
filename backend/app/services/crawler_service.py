from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin

import feedparser
import httpx

from app.config import get_settings
from app.services.github_service import collect_trending_repos, collect_trending_repos_weekly
from app.services.source_labeling import (
    feed_source_name,
    prd_source_type_for_channel,
    short_source_field,
)


def _heat_from_entry(entry: dict[str, Any], idx: int) -> int:
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


def _guess_language(title: str, summary: str) -> str:
    s = f"{title}\n{summary}"
    if not s.strip():
        return "en"
    cjk = sum(1 for c in s if "\u4e00" <= c <= "\u9fff")
    return "zh" if cjk >= max(4, len(s) // 25) else "en"


def _feed_url_implies_social_bridge(feed_url: str) -> bool:
    u = (feed_url or "").lower()
    if "nitter" in u:
        return True
    if "rsshub" in u and ("/twitter/" in u or "/x/" in u):
        return True
    return False


_PAGE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
    "Cache-Control": "no-cache",
}


def discover_rss_links_from_page(page_url: str) -> list[str]:
    """
    打开官网列表页/HTML，提取 alternate RSS/Atom；若响应本身就是 RSS/XML，返回自身 URL。
    """
    page_url = (page_url or "").strip()
    if not page_url:
        return []
    try:
        with httpx.Client(timeout=25.0, follow_redirects=True) as client:
            r = client.get(page_url, headers=_PAGE_HEADERS)
            r.raise_for_status()
            body = r.text
    except Exception:
        return []

    blob = body[:300000]
    head = blob[:4000]
    if re.search(r"<\s*rss\b", head, re.I) or re.search(r"<\s*feed\b", head, re.I):
        return [page_url]

    found: list[str] = []
    for m in re.finditer(r"<link\s[^>]{1,800}?>", blob, re.I):
        tag = m.group(0)
        if "alternate" not in tag.lower():
            continue
        if not re.search(r"type\s*=\s*['\"]application/(rss|atom)\+xml", tag, re.I):
            continue
        hm = re.search(r"href\s*=\s*[\"']([^\"']+)[\"']", tag, re.I)
        if hm:
            found.append(urljoin(page_url, hm.group(1).strip()))

    for m in re.finditer(
        r"type\s*=\s*[\"']application/(?:rss|atom)\+xml[\"'][^>]{0,400}?href\s*=\s*[\"']([^\"']+)[\"']",
        blob,
        re.I,
    ):
        found.append(urljoin(page_url, m.group(1).strip()))

    for m in re.finditer(
        r"href\s*=\s*[\"']([^\"']+)[\"'][^>]{0,400}?type\s*=\s*[\"']application/(?:rss|atom)\+xml[\"']",
        blob,
        re.I,
    ):
        found.append(urljoin(page_url, m.group(1).strip()))

    out: list[str] = []
    dupe: set[str] = set()
    for u in found:
        u = u.strip()
        if u and u not in dupe:
            dupe.add(u)
            out.append(u)
    return out


def fetch_feed_items(
    feed_url: str,
    limit_per_feed: int = 15,
    *,
    feed_channel: str = "official",
) -> list[dict[str, Any]]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        "Cache-Control": "no-cache",
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

    source_type = prd_source_type_for_channel(feed_channel)
    if _feed_url_implies_social_bridge(feed_url):
        source_type = "social"
    elif (feed_url or "").lower().find("/meta/ai/blog") >= 0:
        source_type = "official"

    label = feed_source_name(feed_url)
    short_src = short_source_field(feed_url, label)
    crawl_time = datetime.now(timezone.utc).isoformat()

    for idx, entry in enumerate(getattr(parsed, "entries", [])[:limit_per_feed]):
        title = (entry.get("title") or "").strip()
        link = (entry.get("link") or "").strip()
        summary = (entry.get("summary") or entry.get("description") or "").strip()
        if not title and not link:
            continue
        published_at = _parse_dt(entry)
        author = (entry.get("author") or "").strip()[:200]
        lang = _guess_language(title, summary)
        out.append(
            {
                "source_type": source_type,
                "source": short_src,
                "source_name": label,
                "feed_url": feed_url,
                "title": title[:500],
                "summary": summary[:4000],
                "link": link[:1000],
                "published_at": published_at,
                "heat_score": _heat_from_entry(entry, idx),
                "author": author,
                "raw_text": summary[:8000],
                "language": lang,
                "crawl_time": crawl_time,
                "metrics": {
                    "likes": 0,
                    "shares": 0,
                    "comments": 0,
                    "stars": 0,
                    "forks": 0,
                    "upvotes": 0,
                },
            }
        )
    return out


def _dedupe_key(item: dict[str, Any]) -> str:
    return hashlib.sha256(f"{item.get('link')}|{item.get('title')}".encode("utf-8")).hexdigest()


def _collect_github_block() -> list[dict[str, Any]]:
    from_weekly = False
    try:
        repos = collect_trending_repos_weekly(limit=15)
        from_weekly = True
    except Exception:
        try:
            repos = collect_trending_repos()
        except Exception:
            repos = []
    gh_crawl = datetime.now(timezone.utc).isoformat()
    out: list[dict[str, Any]] = []
    for r in repos:
        item = {
            "source_type": "github",
            "source_tier": 2,
            "source": "GitHub",
            "source_name": "GitHub Trending（本周）" if from_weekly else "GitHub Search",
            "feed_url": "",
            "title": r.title[:500],
            "summary": r.summary[:4000],
            "link": r.html_url[:1000],
            "published_at": r.pushed_at,
            "heat_score": int(r.stars_growth),
            "author": "",
            "raw_text": r.summary[:8000],
            "language": "en",
            "crawl_time": gh_crawl,
            "metrics": {
                "likes": 0,
                "shares": 0,
                "comments": 0,
                "stars": int(r.stars),
                "forks": 0,
                "upvotes": 0,
            },
            "github": {
                "full_name": r.full_name,
                "stars": r.stars,
                "stars_growth": r.stars_growth,
                "language": r.language,
            },
        }
        out.append(item)
    return out


def collect_all_feed_items() -> list[dict[str, Any]]:
    settings = get_settings()
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()

    def append_items(items: list[dict[str, Any]]) -> None:
        for item in items:
            k = _dedupe_key(item)
            if k in seen:
                continue
            seen.add(k)
            merged.append(item)

    for token in settings.crawl_priority_order():
        if token == "github":
            append_items(_collect_github_block())
            continue
        tier, urls, channel = settings._feed_bucket(token)
        for url in urls:
            append_items(
                [
                    {**it, "source_tier": int(tier)}
                    for it in fetch_feed_items(url, feed_channel=channel)
                ]
            )

    for page_url in settings._split_urls(settings.official_page_urls):
        feeds = discover_rss_links_from_page(page_url)
        if not feeds:
            continue
        for furl in feeds:
            append_items(
                [{**it, "source_tier": 0} for it in fetch_feed_items(furl, feed_channel="official")]
            )

    merged.sort(key=lambda x: x.get("heat_score") or 0, reverse=True)
    return merged[:80]
