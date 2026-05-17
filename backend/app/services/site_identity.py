"""访客 IP 哈希与简易滑动窗口限流（进程内，单实例有效）。"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque
from typing import DefaultDict, Deque

from fastapi import HTTPException, Request

from app.config import get_settings

# bucket -> key -> timestamps
_windows: DefaultDict[str, DefaultDict[str, Deque[float]]] = defaultdict(lambda: defaultdict(deque))


def client_ip(request: Request) -> str:
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        return xff.split(",")[0].strip()[:45]
    if request.client and request.client.host:
        return str(request.client.host)[:45]
    return "unknown"


def hash_ip(ip: str, pepper: str) -> str:
    raw = f"{ip}|{pepper}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:48]


def analytics_pepper() -> str:
    settings = get_settings()
    return (getattr(settings, "analytics_ip_pepper", None) or settings.admin_jwt_secret or "aipulse-analytics").strip()


def ip_hash_from_request(request: Request) -> str:
    return hash_ip(client_ip(request), analytics_pepper())


def hash_email(email: str, pepper: str | None = None) -> str:
    p = pepper or analytics_pepper()
    raw = f"{email.strip().lower()}|{p}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:48]


def allow_sliding(key: str, *, bucket: str, max_events: int, window_sec: float) -> bool:
    """滑动窗口内不超过 max_events 次。"""
    store = _windows[bucket]
    now = time.monotonic()
    q = store[key]
    cutoff = now - window_sec
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= max_events:
        return False
    q.append(now)
    return True


def enforce_sliding_limit(
    key: str,
    *,
    bucket: str,
    max_events: int,
    window_sec: float,
    detail: str = "请求过于频繁，请稍后再试。",
) -> None:
    if not allow_sliding(key, bucket=bucket, max_events=max_events, window_sec=window_sec):
        raise HTTPException(status_code=429, detail=detail)


def enforce_sliding_ip_limit(
    request: Request,
    *,
    bucket: str,
    max_events: int,
    window_sec: float,
    detail: str = "请求过于频繁，请稍后再试。",
) -> str:
    """按 IP 限流，返回 ip_hash。"""
    ip_h = ip_hash_from_request(request)
    enforce_sliding_limit(
        ip_h,
        bucket=bucket,
        max_events=max_events,
        window_sec=window_sec,
        detail=detail,
    )
    return ip_h
