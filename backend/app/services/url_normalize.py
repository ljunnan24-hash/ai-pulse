"""
事件来源 URL 规范化：合并追踪参数与主机大小写差异，用于去重与展示。
"""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

_BLOCKED_QUERY_KEYS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
        "source",
        "fbclid",
        "gclid",
    }
)


def normalize_event_source_url(url: str | None) -> str:
    """
    - host 小写
    - 去掉 fragment
    - path 去掉末尾 /
    - 去掉常见追踪 query 参数，其余保留
    """
    if not url or not str(url).strip():
        return ""
    raw = str(url).strip()
    parsed = urlparse(raw)
    scheme = (parsed.scheme or "http").lower()
    netloc = (parsed.netloc or "").lower()
    path = (parsed.path or "").rstrip("/")
    query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in _BLOCKED_QUERY_KEYS
    ]
    qstr = urlencode(query)
    return urlunparse((scheme, netloc, path, "", qstr, ""))


def source_type_trust_rank(source_type: str | None) -> int:
    """数值越大越优先保留（展示/API 去重）。"""
    s = (source_type or "").lower().strip()
    order = ("official", "github", "media", "rss", "community")
    try:
        return len(order) - order.index(s)
    except ValueError:
        return 0
