from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class SocialAccount:
    platform: str
    handle: str
    trust_level: int
    label: str = ""


def load_social_sources(path: str | None = None) -> dict[str, Any]:
    """
    Load machine-readable social sources list.
    Default: docs/social_sources.v1.json at repo root.
    """
    if path:
        p = Path(path)
    else:
        # backend/app/services -> repo root
        p = Path(__file__).resolve().parents[3] / "docs" / "social_sources.v1.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def get_trust_level(platform: str, handle: str, *, data: dict[str, Any] | None = None) -> int:
    """
    Return trust_level for a given social handle/page.
    Unknown -> 1.
    """
    platform = (platform or "").strip().lower()
    h = (handle or "").strip()
    if not platform or not h:
        return 1

    data = data or load_social_sources()
    platforms = data.get("platforms") if isinstance(data, dict) else None
    if not isinstance(platforms, dict):
        return 1
    entries = platforms.get(platform)
    if not isinstance(entries, list):
        return 1

    # X: handle matching
    if platform == "x":
        h_l = h.lower()
        for e in entries:
            if isinstance(e, dict) and str(e.get("handle") or "").lower() == h_l:
                try:
                    return int(e.get("trust_level") or 1)
                except Exception:
                    return 1
        return 1

    # Facebook: match by page_id/page_url/page_name (and keep backward-compat "page")
    if platform == "facebook":
        h_l = h.lower()
        for e in entries:
            if not isinstance(e, dict):
                continue
            # Prefer stable identifiers
            page_id = str(e.get("page_id") or "").strip()
            page_url = str(e.get("page_url") or "").strip().lower()
            page_name = str(e.get("page_name") or e.get("page") or "").strip()
            if page_id and page_id == h:
                try:
                    return int(e.get("trust_level") or 1)
                except Exception:
                    return 1
            if page_url and page_url == h_l:
                try:
                    return int(e.get("trust_level") or 1)
                except Exception:
                    return 1
            if page_name and page_name == h:
                try:
                    return int(e.get("trust_level") or 1)
                except Exception:
                    return 1
        return 1

    return 1

