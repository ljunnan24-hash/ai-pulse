from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import get_settings

# PRD / 清单：描述与标题应能体现 AI 相关性（Search API 回退路径）
_AI_KEYWORD_SUBSTRINGS: tuple[str, ...] = (
    "ai",
    "llm",
    "llms",
    "agent",
    "rag",
    "copilot",
    "chatbot",
    "diffusion",
    "multimodal",
    "neural",
    "machine learning",
    "deep learning",
    "transformer",
    "gpt",
    "claude",
    "openai",
    "pytorch",
    "tensorflow",
    "genai",
    "generative",
    "mllm",
    "vlm",
    "slm",
    "chatglm",
    "llama",
    "mistral",
    "embed",
    "embedding",
    "finetun",
    "fine-tun",
    "dpo",
    "rlhf",
    "sft",
)


def _text_hits_ai_keywords(text: str) -> bool:
    t = (text or "").lower()
    return any(s in t for s in _AI_KEYWORD_SUBSTRINGS)


@dataclass(frozen=True)
class GithubRepoItem:
    full_name: str
    html_url: str
    description: str
    language: str | None
    stars: int
    stars_growth: int
    pushed_at: datetime | None

    @property
    def title(self) -> str:
        return f"{self.full_name}（+{self.stars_growth}★/week）"

    @property
    def summary(self) -> str:
        parts = []
        if self.description:
            parts.append(self.description.strip())
        meta = []
        if self.language:
            meta.append(self.language)
        meta.append(f"Stars {self.stars}")
        meta.append(f"+{self.stars_growth}/week")
        parts.append(" · ".join(meta))
        return " / ".join([p for p in parts if p])


def _auth_headers() -> dict[str, str]:
    settings = get_settings()
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "AI-Pulse-Bot/1.0",
    }
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        # GitHub uses RFC3339, e.g. 2026-04-24T08:22:11Z
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s).astimezone(timezone.utc)
    except Exception:
        return None


def collect_trending_repos() -> list[GithubRepoItem]:
    """
    Minimal deterministic 'Trending' approximation:
    - GitHub Search API: sort by stars, created within configurable window, stars floor.
    - Optional AI keyword filter on name + description (PRD 清单).

    Because GitHub doesn't expose 'weekly stars growth' directly via API, we use stars as
    a popularity proxy on this path.
    """
    settings = get_settings()
    created_within = max(1, int(getattr(settings, "github_search_created_within_days", None) or 180))
    min_stars = max(1, int(getattr(settings, "github_search_min_stars", None) or 500))
    legacy_floor = int(settings.github_trending_min_stars_growth or 0)
    if legacy_floor > min_stars:
        # 兼容旧 .env：若仍设置了很高的「增长阈值」，同步抬高 Search 星星下限
        min_stars = max(min_stars, legacy_floor)
    language = (settings.github_trending_language or "").strip()
    want_ai_filter = bool(getattr(settings, "github_ai_keyword_filter", True))

    since_date = (datetime.now(timezone.utc) - timedelta(days=created_within)).date().isoformat()
    q = f"created:>={since_date} stars:>={min_stars}"
    if language:
        q += f" language:{language}"

    params = {"q": q, "sort": "stars", "order": "desc", "per_page": 30}
    url = "https://api.github.com/search/repositories"

    items: list[GithubRepoItem] = []
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        r = client.get(url, headers=_auth_headers(), params=params)
        r.raise_for_status()
        data = r.json()

    max_age_days = max(1, created_within)

    for repo in (data.get("items") or [])[:30]:
        if not isinstance(repo, dict):
            continue
        full_name = str(repo.get("full_name") or "").strip()
        html_url = str(repo.get("html_url") or "").strip()
        if not full_name or not html_url:
            continue
        stars = int(repo.get("stargazers_count") or 0)
        description = str(repo.get("description") or "")[:800]
        created_at = _parse_dt(repo.get("created_at"))
        if created_at:
            age_days = (datetime.now(timezone.utc) - created_at).days
            if age_days > max_age_days:
                continue
        lang = repo.get("language")
        language_val = str(lang) if isinstance(lang, str) else None
        pushed_at = _parse_dt(repo.get("pushed_at"))

        text_blob = f"{full_name} {description}"
        if want_ai_filter and not _text_hits_ai_keywords(text_blob):
            continue

        stars_growth = stars

        items.append(
            GithubRepoItem(
                full_name=full_name,
                html_url=html_url,
                description=description,
                language=language_val,
                stars=stars,
                stars_growth=stars_growth,
                pushed_at=pushed_at,
            )
        )

    return items


def collect_trending_repos_weekly(limit: int = 15) -> list[GithubRepoItem]:
    """
    Preferred GitHub signal (your requirement):
    - Use GitHub Trending page "This week" and take top N repositories by "stars this week".

    Notes:
    - GitHub does not expose "stars this week" via official REST Search API, so this uses HTML.
    - If blocked/structure changes, caller should fall back to collect_trending_repos().
    """
    limit = max(1, min(int(limit or 15), 50))
    settings = get_settings()
    want_ai_filter = bool(getattr(settings, "github_ai_keyword_filter", True))
    url = "https://github.com/trending?since=weekly"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
        "Cache-Control": "no-cache",
    }

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        r = client.get(url, headers=headers)
        r.raise_for_status()
        html = r.text

    # More robust parsing: split into repo blocks and extract fields within each block.
    # Trending currently renders each repo as an <article class="Box-row">...</article>.
    blocks = re.findall(r'(<article[^>]*class="[^"]*Box-row[^"]*"[\s\S]*?</article>)', html, flags=re.IGNORECASE)

    items: list[GithubRepoItem] = []
    for b in blocks:
        # Repo path should appear in the title <h2> area; pick first match within block.
        m_repo = re.search(r'href="/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)"', b)
        if not m_repo:
            continue
        full_name = m_repo.group(1)

        # Weekly stars appears as "... stars this week"
        weekly = 0
        m_week = re.search(r'([\d,]+)\s+stars\s+this\s+week', b, flags=re.IGNORECASE)
        if m_week:
            try:
                weekly = int(m_week.group(1).replace(",", ""))
            except Exception:
                weekly = 0

        # Optional: description is usually in <p class="col-9 ...">...</p>
        desc = ""
        m_desc = re.search(r'<p[^>]*class="[^"]*col-9[^"]*"[^>]*>\s*([\s\S]*?)\s*</p>', b, flags=re.IGNORECASE)
        if m_desc:
            # Strip tags and compress whitespace
            raw = re.sub(r"<[^>]+>", " ", m_desc.group(1))
            desc = re.sub(r"\s+", " ", raw).strip()[:800]

        blob = f"{full_name} {desc}"
        if want_ai_filter and not _text_hits_ai_keywords(blob):
            continue

        items.append(
            GithubRepoItem(
                full_name=full_name,
                html_url=f"https://github.com/{full_name}",
                description=desc,
                language=None,
                stars=0,
                stars_growth=weekly,
                pushed_at=None,
            )
        )
        if len(items) >= limit:
            break

    return items

