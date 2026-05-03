"""
Human-readable labels + PRD source_type mapping for RSS feeds.
"""

from __future__ import annotations

from urllib.parse import urlparse

# Longest-prefix wins in helper below (match netloc/path snippets → short name)
_LABEL_RULES: list[tuple[str, str]] = [
    ("openai.com", "OpenAI"),
    ("anthropic", "Anthropic"),
    ("deepmind.google", "DeepMind"),
    ("research.google", "Google Research"),
    ("blog.google/technology/ai", "Google AI Blog"),
    ("blogs.microsoft.com/ai", "Microsoft AI"),
    ("azure.microsoft.com", "Azure Blog"),
    ("github.blog", "GitHub Blog"),
    ("aws.amazon.com/blogs/machine-learning", "AWS ML Blog"),
    ("apple.com/newsroom", "Apple Newsroom"),
    ("machinelearning.apple.com", "Apple ML"),
    ("engineering.fb.com", "Meta Engineering"),
    ("ai.meta.com", "Meta AI"),
    ("blogs.nvidia.com", "NVIDIA Blog"),
    ("nvidianews.nvidia.com", "NVIDIA News"),
    ("databricks.com", "Databricks"),
    ("cohere", "Cohere"),
    ("huggingface.co", "Hugging Face"),
    ("stability.ai", "Stability AI"),
    ("jiqizhixin.com", "机器之心"),
    ("qbitai.com", "量子位"),
    ("infoq.cn", "InfoQ"),
    ("techcrunch.com", "TechCrunch"),
    ("theverge.com", "The Verge"),
    ("venturebeat.com", "VentureBeat"),
    ("technologyreview.com", "MIT Technology Review"),
    ("hacker-news.firebaseio.com", "Hacker News"),
    ("hn.algolia.com", "Hacker News (Algolia)"),
    ("reddit.com", "Reddit"),
    ("rsshub.app", "RSSHub"),
    ("nitter", "Nitter"),
    ("producthunt.com", "Product Hunt"),
    ("marktechpost.com", "MarkTechPost"),
    ("syncedreview.com", "Synced Review"),
    ("infoq.com", "InfoQ"),
]

_CHANNEL_TO_PRD: dict[str, str] = {
    "official": "official",
    "media": "media",
    "meta": "official",
    "product": "product",
    "community": "community",
    "x": "social",
}


def prd_source_type_for_channel(channel: str) -> str:
    return _CHANNEL_TO_PRD.get((channel or "").lower().strip(), "official")


def feed_source_name(feed_url: str) -> str:
    u = (feed_url or "").strip().lower()
    if not u:
        return "unknown"
    for needle, name in _LABEL_RULES:
        if needle in u:
            return name
    try:
        p = urlparse(feed_url)
        host = (p.netloc or "").lower().replace("www.", "")
        path = (p.path or "").strip("/")
        tail = path.split("/")[-1][:40] if path else ""
        if tail and tail not in ("feed", "rss", "rss.xml"):
            return f"{host} · {tail}"
        return host or feed_url[:80]
    except Exception:
        return feed_url[:80]


def short_source_field(feed_url: str, source_name: str, max_len: int = 128) -> str:
    """Fits ORM `raw_items.source` VARCHAR(128)."""
    base = source_name or feed_source_name(feed_url)
    if len(base) <= max_len:
        return base
    try:
        host = urlparse(feed_url).netloc[:60]
        return host or base[:max_len]
    except Exception:
        return base[:max_len]
