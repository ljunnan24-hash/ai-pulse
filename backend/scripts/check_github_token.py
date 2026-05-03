from __future__ import annotations

import json
import ssl
import urllib.request
from pathlib import Path


def load_token() -> str:
    p = Path(__file__).resolve().parents[1] / ".env"  # backend/.env
    if not p.exists():
        return ""
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == "GITHUB_TOKEN":
            return v.strip().strip('"').strip("'")
    return ""


def main() -> int:
    token = load_token()
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "AI-Pulse-Bot/1.0",
    }
    if token:
        headers["Authorization"] = "Bearer " + token

    req = urllib.request.Request("https://api.github.com/rate_limit", headers=headers)
    # Some Windows/Conda installs have broken default CA paths.
    # Prefer certifi's CA bundle when available.
    ctx = None
    try:
        import certifi  # type: ignore

        ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()

    with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
        data = json.load(r)
    search = data["resources"]["search"]
    core = data["resources"]["core"]

    print("token_present", bool(token))
    print("search", {"limit": search.get("limit"), "remaining": search.get("remaining"), "reset": search.get("reset")})
    print("core", {"limit": core.get("limit"), "remaining": core.get("remaining"), "reset": core.get("reset")})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

