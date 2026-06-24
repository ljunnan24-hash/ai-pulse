from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import func, inspect as sa_inspect, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.database import SessionLocal
from app.models import RssSource

log = logging.getLogger("uvicorn.error")

VALID_RSS_CHANNELS = ("official", "meta", "media", "product", "community", "x")
CHANNEL_TIERS = {
    "official": 0,
    "meta": 0,
    "media": 1,
    "product": 2,
    "community": 3,
    "x": 4,
}


@dataclass(frozen=True)
class EffectiveRssSource:
    tier: int
    url: str
    channel: str
    name: str = ""


def normalize_rss_url(url: str) -> str:
    u = (url or "").strip()
    while True:
        lo = u.lower()
        if lo.startswith("https://https://"):
            u = u[8:]
        elif lo.startswith("http://https://"):
            u = u[7:]
        elif lo.startswith("https://http://"):
            u = u[8:]
        elif lo.startswith("http://http://"):
            u = u[7:]
        else:
            break
    return u.strip()


def rss_url_hash(url: str) -> str:
    return hashlib.sha256(normalize_rss_url(url).encode("utf-8")).hexdigest()


def validate_rss_url(url: str) -> str:
    u = normalize_rss_url(url)
    parsed = urlparse(u)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("RSS URL must be an absolute http(s) URL.")
    return u


def normalize_channel(channel: str | None) -> str:
    ch = (channel or "official").strip().lower()
    if ch not in VALID_RSS_CHANNELS:
        raise ValueError(f"invalid RSS channel: {ch}")
    return ch


def tier_for_channel(channel: str | None) -> int:
    return int(CHANNEL_TIERS.get(normalize_channel(channel), 2))


def default_source_name(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host[:256] or url[:256]


def rss_sources_table_available(db: Session) -> bool:
    bind = db.get_bind()
    if not bind:
        return False
    try:
        return bool(sa_inspect(bind).has_table("rss_sources"))
    except Exception:
        return False


def env_rss_sources(settings: Settings | None = None) -> list[EffectiveRssSource]:
    s = settings or get_settings()
    out: list[EffectiveRssSource] = []
    for key in s.crawl_priority_order():
        if key == "github":
            continue
        tier, urls, channel = s._feed_bucket(key)
        for url in urls:
            out.append(EffectiveRssSource(tier=int(tier), url=url, channel=channel, name=default_source_name(url)))
    return out


def db_rss_source_count(db: Session) -> int:
    if not rss_sources_table_available(db):
        return 0
    return int(db.scalar(select(func.count(RssSource.id))) or 0)


def db_rss_sources(db: Session, *, enabled_only: bool = False) -> list[RssSource]:
    if not rss_sources_table_available(db):
        return []
    stmt = select(RssSource).order_by(RssSource.tier.asc(), RssSource.channel.asc(), RssSource.name.asc(), RssSource.id.asc())
    if enabled_only:
        stmt = stmt.where(RssSource.is_enabled == 1)
    return list(db.scalars(stmt).all())


def effective_rss_sources_by_channel(settings: Settings | None = None) -> tuple[dict[str, list[EffectiveRssSource]], str]:
    """
    Return effective RSS sources grouped by crawler channel.

    mode = "database" means rss_sources has at least one row, so enabled rows are authoritative.
    mode = "env" means no table rows are configured yet, so existing .env RSS settings stay active.
    """
    s = settings or get_settings()
    grouped: dict[str, list[EffectiveRssSource]] = {ch: [] for ch in VALID_RSS_CHANNELS}

    try:
        with SessionLocal() as db:
            if db_rss_source_count(db) > 0:
                for row in db_rss_sources(db, enabled_only=True):
                    try:
                        ch = normalize_channel(row.channel)
                    except ValueError:
                        continue
                    url = normalize_rss_url(row.url)
                    if not url:
                        continue
                    grouped.setdefault(ch, []).append(
                        EffectiveRssSource(tier=int(row.tier), url=url, channel=ch, name=row.name or default_source_name(url))
                    )
                return grouped, "database"
    except Exception as exc:
        log.warning("rss_source_registry: database RSS source lookup failed; falling back to .env: %s", exc)

    for src in env_rss_sources(s):
        grouped.setdefault(src.channel, []).append(src)
    return grouped, "env"


def source_to_dict(src: EffectiveRssSource, *, readonly: bool = False) -> dict[str, Any]:
    return {
        "id": None,
        "name": src.name or default_source_name(src.url),
        "url": src.url,
        "url_hash": rss_url_hash(src.url),
        "channel": src.channel,
        "tier": int(src.tier),
        "is_enabled": True,
        "note": None,
        "readonly": readonly,
        "created_at": None,
        "updated_at": None,
    }
