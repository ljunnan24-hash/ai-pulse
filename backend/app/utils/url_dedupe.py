"""
RSS / RawItem 入库去重：URL 规范化与稳定哈希（与 GlobalEvent 的 url_normalize 独立，规则更严）。
"""

from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# 常见追踪参数（小写比较）；utm*（含 utm_source、utm 等）用 startswith 处理
_BLOCKED_QUERY_KEYS = frozenset(
    {
        "fbclid",
        "gclid",
        "ref",
        "ref_src",
        "spm",
        "mc_cid",
        "mc_eid",
        "source",  # 部分站点用 ?source= 追踪
    }
)


def _blocked_query_key(key: str) -> bool:
    kl = (key or "").lower().strip()
    if kl.startswith("utm"):
        return True
    return kl in _BLOCKED_QUERY_KEYS


def _rebuild_netloc(parsed) -> str:
    scheme = (parsed.scheme or "https").lower()
    host = parsed.hostname
    if not host:
        return (parsed.netloc or "").lower()
    port = parsed.port
    user = parsed.username or ""
    pw = parsed.password or ""
    auth = ""
    if user:
        auth = f"{user}:{pw}@" if pw else f"{user}@"
    hl = host.lower()
    is_v6 = "::" in host or (host.count(":") > 1 and "." not in host)
    strip_default = port is not None and (
        (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    )
    if strip_default or port is None:
        hostonly = f"[{hl}]" if is_v6 else hl
        return f"{auth}{hostonly}"
    hostonly = f"[{hl}]:{port}" if is_v6 else f"{hl}:{port}"
    return f"{auth}{hostonly}"


def normalize_url_for_dedupe(url: str | None) -> str:
    """
    - scheme / host 小写
    - 去掉 fragment
    - 去掉常见追踪参数；其余 query 按 key 排序
    - 去掉 http:80 / https:443 默认端口
    - path 去掉末尾 /
    - 无法解析时退回 strip 后的原始串（截断）
    """
    if url is None:
        return ""
    raw = str(url).strip()
    if not raw:
        return ""
    to_parse = raw
    if "://" not in to_parse and to_parse.startswith("//"):
        to_parse = "https:" + to_parse
    elif "://" not in to_parse:
        # 无 scheme 的相对或裸 host，不做结构化规范化，退回原文
        return raw[:2048]
    try:
        p = urlparse(to_parse)
    except Exception:
        return raw[:2048]
    scheme = (p.scheme or "https").lower()
    netloc = _rebuild_netloc(p)
    if not netloc:
        return raw[:2048]
    path = (p.path or "").rstrip("/")
    if not path:
        path = ""
    q_pairs = [
        (k, v)
        for k, v in parse_qsl(p.query, keep_blank_values=True)
        if not _blocked_query_key(k)
    ]
    q_pairs.sort(key=lambda kv: (kv[0].lower(), kv[0], kv[1]))
    qstr = urlencode(q_pairs)
    out = urlunparse((scheme, netloc, path, "", qstr, ""))
    return out[:2048]


def url_dedupe_hash(url: str | None) -> str:
    """SHA256 十六进制；输入无效时退回对 strip 原文的哈希。"""
    if url is None:
        return hashlib.sha256(b"").hexdigest()
    raw = str(url).strip()
    if not raw:
        return hashlib.sha256(b"").hexdigest()
    norm = normalize_url_for_dedupe(raw)
    basis = norm if norm else raw
    return hashlib.sha256(basis.encode("utf-8", errors="replace")).hexdigest()


def normalize_title_for_dedupe(title: str | None) -> str:
    t = (title or "").strip().lower()
    t = re.sub(r"\s+", " ", t)
    return t[:4000]


def title_dedupe_hash(title: str | None) -> str:
    return hashlib.sha256(normalize_title_for_dedupe(title).encode("utf-8", errors="replace")).hexdigest()


def item_stable_dedupe_key(item: dict) -> str:
    """与 RawItem 入库、collect 内 append 使用同一套身份键。"""
    link = (item.get("link") or "").strip()
    if link:
        return "h:" + url_dedupe_hash(link)
    return "t:" + title_dedupe_hash(item.get("title"))


def attach_raw_dedupe_fields(item: dict) -> None:
    """写入 item 字典供 daily_rankings 写库与过滤；不破坏现有字段。"""
    link = (item.get("link") or "").strip()
    if link:
        norm = normalize_url_for_dedupe(link)
        item["_normalized_link"] = norm if norm else ""
        item["_normalized_link_hash"] = url_dedupe_hash(link)
        item["_title_dedupe_hash"] = ""
    else:
        item["_normalized_link"] = ""
        th = title_dedupe_hash(item.get("title"))
        # 无 URL 时复用 normalized_link_hash 存标题哈希，便于跨 run 在库内查重
        item["_normalized_link_hash"] = th
        item["_title_dedupe_hash"] = th
