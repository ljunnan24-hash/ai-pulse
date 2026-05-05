"""HMAC 签名追踪 token（邮件打开像素、点击重定向、落地页 ?t=）。"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any


def sign_tracking_payload(payload: dict[str, Any], secret: str) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    tb = base64.urlsafe_b64encode(body).decode("ascii").rstrip("=")
    ts = base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")
    return f"{tb}.{ts}"


def verify_tracking_token(token: str, secret: str) -> dict[str, Any] | None:
    if not token or not secret:
        return None
    try:
        tb, ts = token.split(".", 1)
        body = base64.urlsafe_b64decode(tb + "=" * (-len(tb) % 4))
        sig = base64.urlsafe_b64decode(ts + "=" * (-len(ts) % 4))
        expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None
        p = json.loads(body.decode("utf-8"))
        exp = int(p.get("exp") or 0)
        if exp < time.time():
            return None
        return p if isinstance(p, dict) else None
    except Exception:
        return None


def default_token_ttl_seconds(*, days: int = 21) -> int:
    return days * 86400


def token_expiry_epoch(*, days: int = 21) -> int:
    return int(time.time()) + default_token_ttl_seconds(days=days)
