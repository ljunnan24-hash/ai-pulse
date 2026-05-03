from __future__ import annotations

import sys

import httpx


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    if not url:
        print("Usage: python scripts/test_feed_fetch.py <feed_url>")
        return 2

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

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        r = client.get(url, headers=headers)
        print("status:", r.status_code)
        print("content-type:", r.headers.get("content-type"))
        print("first-bytes:", r.text[:200].replace("\n", "\\n"))
        return 0 if r.status_code == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())

