from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urljoin

import feedparser
import httpx

from app.config import get_settings
from app.services.feed_crawl_report import (
    FeedCrawlReport,
    FeedCrawlTimer,
    body_looks_like_feed,
    content_type_implies_feed,
    should_mark_invalid_feed,
    utcnow,
)
from app.utils.url_dedupe import item_stable_dedupe_key
from app.services.github_service import collect_trending_repos, collect_trending_repos_weekly
from app.services.rss_source_registry import effective_rss_sources_by_channel
from app.services.source_labeling import (
    feed_source_name,
    prd_source_type_for_channel,
    short_source_field,
)

_log = logging.getLogger("uvicorn.error")

_FEED_RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
_FEED_MAX_ATTEMPTS = 3
_FEED_RETRY_DELAYS_SECONDS = (2.0, 5.0)


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


def _retry_after_seconds(value: str | None) -> float | None:
    raw = (value or "").strip()
    if not raw:
        return None
    try:
        delay = float(raw)
    except ValueError:
        try:
            dt = parsedate_to_datetime(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            delay = (dt - datetime.now(timezone.utc)).total_seconds()
        except (TypeError, ValueError, IndexError, OverflowError):
            return None
    if delay <= 0:
        return 0.0
    return min(delay, 30.0)


def _feed_retry_delay(attempt: int, response: httpx.Response | None) -> float:
    if response is not None:
        retry_after = _retry_after_seconds(response.headers.get("retry-after"))
        if retry_after is not None:
            return retry_after
    idx = max(0, min(attempt - 1, len(_FEED_RETRY_DELAYS_SECONDS) - 1))
    return _FEED_RETRY_DELAYS_SECONDS[idx]


def _should_retry_feed_fetch(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in _FEED_RETRY_STATUS_CODES
    return isinstance(exc, (httpx.TimeoutException, httpx.TransportError))


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


def _log_feed_health_line(rep: FeedCrawlReport) -> None:
    ch = rep.feed_channel or "?"
    hs = rep.health_status
    url = (rep.feed_url or "")[:200]
    if hs == "invalid_feed":
        msg = (
            f"[feed-health] {ch} {hs} http={rep.http_status} "
            f"content_type={rep.content_type or '?'} url={url}"
        )
    else:
        msg = (
            f"[feed-health] {ch} {hs} entries={rep.raw_entry_count} "
            f"emitted={rep.emitted_item_count} url={url}"
        )
    print(msg)
    _log.info(msg)


def fetch_feed_items_with_report(
    feed_url: str,
    limit_per_feed: int = 15,
    *,
    feed_channel: str = "official",
    run_id: str = "",
    job_name: str = "fetch_feed_items",
    run_at: datetime | None = None,
) -> tuple[list[dict[str, Any]], FeedCrawlReport]:
    run_at = run_at or utcnow()
    timer = FeedCrawlTimer()
    feed_url = (feed_url or "").strip()
    out: list[dict[str, Any]] = []

    if not feed_url:
        rep = FeedCrawlReport(
            run_id=run_id or "",
            job_name=job_name,
            feed_url="",
            feed_channel=feed_channel,
            http_status=None,
            content_type=None,
            fetch_ok=False,
            parse_ok=False,
            raw_entry_count=0,
            emitted_item_count=0,
            inserted_item_count=None,
            health_status="fetch_failed",
            error_class="ValueError",
            error_message="empty feed_url",
            duration_ms=timer.elapsed_ms(),
            run_at=run_at,
        )
        _log_feed_health_line(rep)
        return [], rep

    def _finish(
        *,
        http_status: int | None,
        content_type: str | None,
        fetch_ok: bool,
        parse_ok: bool,
        raw_entry_count: int,
        emitted_item_count: int,
        health_status: str,
        error_class: str | None,
        error_message: str | None,
        items: list[dict[str, Any]] | None = None,
    ) -> tuple[list[dict[str, Any]], FeedCrawlReport]:
        rep = FeedCrawlReport(
            run_id=run_id or "",
            job_name=job_name,
            feed_url=feed_url,
            feed_channel=feed_channel,
            http_status=http_status,
            content_type=content_type,
            fetch_ok=fetch_ok,
            parse_ok=parse_ok,
            raw_entry_count=raw_entry_count,
            emitted_item_count=emitted_item_count,
            inserted_item_count=None,
            health_status=health_status,
            error_class=error_class,
            error_message=error_message,
            duration_ms=timer.elapsed_ms(),
            run_at=run_at,
        )
        _log_feed_health_line(rep)
        return (items if items is not None else out, rep)

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

    http_status: int | None = None
    content_type: str | None = None
    body: bytes | None = None
    httpx_ok = False
    httpx_err: str | None = None

    attempts = 0
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        for attempt in range(1, _FEED_MAX_ATTEMPTS + 1):
            attempts = attempt
            try:
                r = client.get(feed_url, headers=headers)
                http_status = r.status_code
                content_type = r.headers.get("content-type")
                r.raise_for_status()
                body = r.content
                httpx_ok = True
                httpx_err = None
                break
            except Exception as exc:
                response = exc.response if isinstance(exc, httpx.HTTPStatusError) else None
                if response is not None:
                    http_status = response.status_code
                    content_type = response.headers.get("content-type")
                httpx_err = f"{type(exc).__name__} after {attempts} attempt(s): {exc}"
                if attempt >= _FEED_MAX_ATTEMPTS or not _should_retry_feed_fetch(exc):
                    break
                delay = _feed_retry_delay(attempt, response)
                _log.info(
                    "feed fetch retry in %.1fs attempt=%s url=%s error=%s",
                    delay,
                    attempt + 1,
                    feed_url,
                    httpx_err,
                )
                time.sleep(delay)

    parsed: Any = None
    used_url_fallback = False

    if httpx_ok and body is not None:
        if should_mark_invalid_feed(http_status, content_type, body):
            return _finish(
                http_status=http_status,
                content_type=content_type,
                fetch_ok=True,
                parse_ok=False,
                raw_entry_count=0,
                emitted_item_count=0,
                health_status="invalid_feed",
                error_class="InvalidFeedContent",
                error_message="HTTP success but body does not look like RSS/Atom",
            )
        try:
            parsed = feedparser.parse(body)
        except Exception as exc:
            return _finish(
                http_status=http_status,
                content_type=content_type,
                fetch_ok=True,
                parse_ok=False,
                raw_entry_count=0,
                emitted_item_count=0,
                health_status="parse_failed",
                error_class=type(exc).__name__,
                error_message=str(exc)[:2000],
            )
    else:
        try:
            parsed = feedparser.parse(feed_url)
            used_url_fallback = True
        except Exception as exc:
            return _finish(
                http_status=http_status,
                content_type=content_type,
                fetch_ok=False,
                parse_ok=False,
                raw_entry_count=0,
                emitted_item_count=0,
                health_status="fetch_failed",
                error_class=type(exc).__name__,
                error_message=(httpx_err or str(exc))[:2000],
            )

    entries = list(getattr(parsed, "entries", []) or [])
    raw_entry_count = len(entries)

    source_type = prd_source_type_for_channel(feed_channel)
    if _feed_url_implies_social_bridge(feed_url):
        source_type = "social"
    elif feed_url and feed_url.lower().find("/meta/ai/blog") >= 0:
        source_type = "official"

    label = feed_source_name(feed_url)
    short_src = short_source_field(feed_url, label)
    crawl_time = datetime.now(timezone.utc).isoformat()

    for idx, entry in enumerate(entries[:limit_per_feed]):
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

    emitted = len(out)
    parse_ok = True
    fetch_ok = bool(httpx_ok or emitted > 0 or raw_entry_count > 0)

    if raw_entry_count == 0:
        health = "fetch_failed" if not httpx_ok else "empty_feed"
    elif emitted == 0:
        health = "all_filtered"
    else:
        health = "ok"

    if health == "fetch_failed":
        parse_ok = False

    return _finish(
        http_status=http_status,
        content_type=content_type,
        fetch_ok=fetch_ok,
        parse_ok=parse_ok,
        raw_entry_count=raw_entry_count,
        emitted_item_count=emitted,
        health_status=health,
        error_class=None,
        error_message=(f"feedparser.parse(url) fallback after {httpx_err}"[:2000] if used_url_fallback and httpx_err else None),
    )


def fetch_feed_items(
    feed_url: str,
    limit_per_feed: int = 15,
    *,
    feed_channel: str = "official",
) -> list[dict[str, Any]]:
    items, _ = fetch_feed_items_with_report(
        feed_url,
        limit_per_feed,
        feed_channel=feed_channel,
        run_id="",
        job_name="fetch_feed_items",
    )
    return items


def _dedupe_key(item: dict[str, Any]) -> str:
    """单次 run 内合并：规范化 URL 哈希优先，无 link 时用标题哈希。"""
    return item_stable_dedupe_key(item)


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


def collect_all_feed_items_with_reports(
    *,
    run_id: str | None = None,
    job_name: str = "collect_all_feed_items",
    run_at: datetime | None = None,
) -> tuple[list[dict[str, Any]], list[FeedCrawlReport]]:
    run_id = run_id or str(uuid.uuid4())
    run_at = run_at or utcnow()
    settings = get_settings()
    rss_sources_by_channel, _rss_source_mode = effective_rss_sources_by_channel(settings)
    merged: list[dict[str, Any]] = []
    reports: list[FeedCrawlReport] = []
    seen: set[str] = set()
    seen_feed_urls: set[str] = set()

    def _fetch_feed_once(url: str, feed_channel: str) -> tuple[list[dict[str, Any]], FeedCrawlReport]:
        u = (url or "").strip()
        t0 = FeedCrawlTimer()
        if u in seen_feed_urls:
            rep = FeedCrawlReport(
                run_id=run_id,
                job_name=job_name,
                feed_url=u,
                feed_channel=feed_channel,
                http_status=None,
                content_type=None,
                fetch_ok=True,
                parse_ok=True,
                raw_entry_count=0,
                emitted_item_count=0,
                inserted_item_count=None,
                health_status="skipped_duplicate_feed",
                error_class=None,
                error_message="duplicate feed_url in same run",
                duration_ms=t0.elapsed_ms(),
                run_at=run_at,
            )
            _log_feed_health_line(rep)
            return [], rep
        seen_feed_urls.add(u)
        return fetch_feed_items_with_report(
            u,
            feed_channel=feed_channel,
            run_id=run_id,
            job_name=job_name,
            run_at=run_at,
        )

    def append_items(items: list[dict[str, Any]]) -> None:
        for item in items:
            k = _dedupe_key(item)
            if k in seen:
                continue
            seen.add(k)
            merged.append(item)

    for token in settings.crawl_priority_order():
        if token == "github":
            gh_timer = FeedCrawlTimer()
            gh_items = _collect_github_block()
            gh_rep = FeedCrawlReport(
                run_id=run_id,
                job_name=job_name,
                feed_url="",
                feed_channel="github",
                http_status=None,
                content_type=None,
                fetch_ok=len(gh_items) > 0,
                parse_ok=len(gh_items) > 0,
                raw_entry_count=len(gh_items),
                emitted_item_count=len(gh_items),
                inserted_item_count=None,
                health_status="ok" if gh_items else "empty_feed",
                error_class=None,
                error_message=None,
                duration_ms=gh_timer.elapsed_ms(),
                run_at=run_at,
            )
            _log_feed_health_line(gh_rep)
            reports.append(gh_rep)
            append_items(gh_items)
            continue
        for src in rss_sources_by_channel.get(token, []):
            items, rep = _fetch_feed_once(src.url, src.channel)
            reports.append(rep)
            append_items([{**it, "source_tier": int(src.tier)} for it in items])

    for page_url in settings._split_urls(settings.official_page_urls):
        feeds = discover_rss_links_from_page(page_url)
        if not feeds:
            continue
        for furl in feeds:
            items, rep = _fetch_feed_once(furl, "official")
            reports.append(rep)
            append_items([{**it, "source_tier": 0} for it in items])

    merged.sort(key=lambda x: x.get("heat_score") or 0, reverse=True)
    return merged[:80], reports


def collect_all_feed_items() -> list[dict[str, Any]]:
    items, _ = collect_all_feed_items_with_reports(
        run_id=str(uuid.uuid4()),
        job_name="collect_all_feed_items",
    )
    return items
