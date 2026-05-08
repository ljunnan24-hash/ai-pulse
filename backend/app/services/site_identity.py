"""访客 IP 哈希与简易滑动窗口限流（进程内，单实例有效）。"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict, deque
from typing import DefaultDict, Deque

from fastapi import Request


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


_pv_windows: DefaultDict[str, Deque[float]] = defaultdict(deque)
_fb_windows: DefaultDict[str, Deque[float]] = defaultdict(deque)


def allow_sliding(key: str, *, bucket: str, max_events: int, window_sec: float) -> bool:
    """滑动窗口内不超过 max_events 次。"""
    store = _pv_windows if bucket == "pv" else _fb_windows
    now = time.monotonic()
    q = store[key]
    cutoff = now - window_sec
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= max_events:
        return False
    q.append(now)
    return True
