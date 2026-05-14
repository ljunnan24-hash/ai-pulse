"""
不依赖 feedparser：用 urllib 验证列表页是否含 RSS link，以及 URL 是否像 RSS 正文。

运行: cd backend && python scripts/verify_feeds_stdlib.py
      cd backend && python scripts/verify_feeds_stdlib.py --check-url https://example.com/feed.xml
"""
from __future__ import annotations

import argparse
import re
import ssl
import urllib.request
from urllib.parse import urljoin

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def fetch(url: str, limit: int = 400_000, accept: str = "*/*") -> tuple[int, str, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": accept,
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        },
    )
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        code = r.getcode()
        ct = (r.headers.get("Content-Type") or "")[:120]
        body = r.read(limit).decode("utf-8", errors="replace")
    return code, ct, body


def discover_feeds(page_url: str, body: str) -> list[str]:
    blob = body[:300_000]
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
    head = blob[:4000]
    if re.search(r"<\s*rss\b", head, re.I) or re.search(r"<\s*feed\b", head, re.I):
        found.insert(0, page_url)
    # dedupe
    seen: set[str] = set()
    out: list[str] = []
    for u in found:
        if u and u not in seen:
            seen.add(u)
            out.append(u)
    return out


def rss_like(body: str) -> bool:
    h = body[:8000].lower()
    return "<rss" in h or "<feed" in h


def item_count_hint(body: str) -> int:
    blob = body[:500_000]
    return len(re.findall(r"<item\b", blob, re.I)) + len(re.findall(r"<entry\b", blob, re.I))


def verify_rss_url(url: str, accept: str = "application/rss+xml, application/xml, text/xml, */*") -> dict[str, object]:
    """返回 HTTP 状态、content-type、rss_like、条目数近似（与 rss_source_governance 验收口径一致）。"""
    try:
        code, ct, body = fetch(url, accept=accept)
    except Exception as e:
        return {"url": url, "ok": False, "error": f"{type(e).__name__}: {e}"}
    like = rss_like(body)
    n = item_count_hint(body) if like else 0
    return {
        "url": url,
        "ok": bool(code and 200 <= int(code) < 300 and like and n > 0),
        "http_status": code,
        "content_type": ct,
        "rss_like": like,
        "item_count": n,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Verify RSS / discover feeds (stdlib only)")
    ap.add_argument(
        "--check-url",
        action="append",
        dest="check_urls",
        metavar="URL",
        help="可重复；仅检查该 URL 是否为可用 RSS（HTTP 2xx + rss_like + item_count>0）",
    )
    ap.add_argument(
        "--nvidia-defaults",
        action="store_true",
        help="检查 NVIDIA 治理候选三条（releases / generative_al / feedburner）",
    )
    args = ap.parse_args()

    if args.check_urls or args.nvidia_defaults:
        urls = list(args.check_urls or [])
        if args.nvidia_defaults:
            urls.extend(
                [
                    "https://nvidianews.nvidia.com/releases.xml",
                    "https://nvidianews.nvidia.com/cats/generative_al.xml",
                    "https://feeds.feedburner.com/nvidiablog",
                ]
            )
        for u in urls:
            r = verify_rss_url(u)
            print(r)
        return

    pages = [
        "https://www.deepseek.com/",
        "https://tongyi.aliyun.com/",
        "https://ai.baidu.com/tech",
        "https://cloud.tencent.com/product/hunyuan",
        "https://open.bigmodel.cn/",
        "https://platform.moonshot.cn/",
        "https://www.minimax.chat/",
        "https://www.stepfun.com/",
        "https://www.sensecore.cn/",
        "https://www.volcengine.com/product/doubao",
        "https://www.volcengine.com/news",
    ]
    rss_urls = [
        ("https://openai.com/blog/rss.xml", "*/*"),
        ("https://huggingface.co/blog/feed.xml", "*/*"),
        ("https://www.jiqizhixin.com/rss", "application/rss+xml, application/xml, text/xml, */*"),
        ("https://www.volcengine.com/blog/feed/", "application/rss+xml, application/xml, text/xml, */*"),
    ]

    print("=== OFFICIAL_PAGE_URLS (discover <link rel=alternate rss|atom>) ===\n")
    for u in pages:
        try:
            code, ct, body = fetch(u)
            feeds = discover_feeds(u, body)
            print(f"URL: {u}")
            print(f"  HTTP {code} | {ct}")
            print(f"  discovered_feeds: {len(feeds)} -> {feeds[:5]}")
        except Exception as e:
            print(f"URL: {u}\n  ERR: {type(e).__name__}: {e}")
        print()

    print("=== Direct RSS sample (rss_like + ~item count) ===\n")
    for u, acc in rss_urls:
        try:
            code, ct, body = fetch(u, accept=acc)
            like = rss_like(body)
            n = item_count_hint(body) if like else 0
            print(f"URL: {u}")
            print(f"  HTTP {code} | {ct} | rss_like={like} | ~items={n}")
        except Exception as e:
            print(f"URL: {u}\n  ERR: {type(e).__name__}: {e}")
        print()


if __name__ == "__main__":
    main()
