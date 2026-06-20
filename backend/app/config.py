from functools import lru_cache
from typing import List, Tuple

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _sanitize_list_url(url: str) -> str:
    """逗号列表里的 RSS/HTML URL：纠正常见的 `https://https://host` 重复 scheme。"""
    u = (url or "").strip()
    while True:
        lo = u.lower()
        if lo.startswith("https://https://"):
            u = u[8:]
        elif lo.startswith("http://https://"):
            u = u[7:]
        elif lo.startswith("https://http://"):
            u = u[8:]
        elif lo.startswith("http://http://"):
            u = u[7:]
        else:
            break
    return u.strip()


class Settings(BaseSettings):
    # 环境变量名：大写 + 下划线，与 .env 中 RANKING_INSIGHT_*、WEEKLY_SOURCE、GLOBAL_EVENTS_* 一致
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    database_url: str = "mysql+pymysql://root:password@127.0.0.1:3306/aipulse?charset=utf8mb4"
    # RDS 开启 SSL 时：阿里云下载的 ApsaraDB-CA-Chain.pem 绝对路径（与 mysql --ssl-ca 一致）
    database_ssl_ca: str = ""

    # 匿名埋点 / 反馈：IP 哈希盐（可选；默认回退 admin_jwt_secret）
    analytics_ip_pepper: str = ""

    public_app_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    # 对外周报页与邮件 main_link 使用的站点根（须含协议与域名）
    weekly_public_base_url: str = "http://localhost:3000"

    # Generic OpenAI-compatible chat completions API.
    # Preferred for new deployments. Override LLM_API_BASE for non-OpenAI providers.
    llm_api_key: str = ""
    llm_api_base: str = "https://api.openai.com/v1"
    llm_model: str = ""
    # 0 = do not send a default max_tokens value for the generic API.
    llm_max_tokens: int = 0

    # Volcengine Ark (豆包) — legacy fallback for existing deployments
    doubao_api_key: str = ""
    doubao_api_base: str = "https://ark.cn-beijing.volces.com/api/v3"
    doubao_model: str = ""
    # Composer 等大 JSON 输出默认上限；过小会导致截断、JSONDecodeError（设为 0 则请求里不传，走平台默认）
    doubao_max_tokens: int = 16384

    @property
    def use_generic_llm_api(self) -> bool:
        """True when the new generic API key/model pair is complete."""
        return bool(self.llm_api_key and self.llm_model)

    @property
    def effective_llm_api_key(self) -> str:
        return self.llm_api_key if self.use_generic_llm_api else self.doubao_api_key

    @property
    def effective_llm_api_base(self) -> str:
        return self.llm_api_base if self.use_generic_llm_api else self.doubao_api_base

    @property
    def effective_llm_model(self) -> str:
        return self.llm_model if self.use_generic_llm_api else self.doubao_model

    @property
    def effective_llm_max_tokens(self) -> int:
        return self.llm_max_tokens if self.use_generic_llm_api else self.doubao_max_tokens

    # 周刊流水线（见 docs/MULTI_AGENT_V1.md）
    # WEEKLY_SOURCE 仅支持 global_events（legacy 已从 generate_weekly 移除）
    # multi_agent_weekly=true → thesis/capability/glossary 3×LLM；false → 确定性 thesis，Top3 仍按分数
    multi_agent_weekly: bool = True
    multi_agent_digest_top_n: int = 20
    # Editor：多一次 LLM 润色 payload，延时长；Auditor：事实/安全审计，high/use_fallback 时回退确定性组装
    multi_agent_enable_editor: bool = False
    multi_agent_enable_auditor: bool = False
    # Email Deliverability Auditor + Rewriter（结构化 payload，在 finalize 之前；默认开启）
    multi_agent_enable_deliverability: bool = True
    # 低于该分触发改写（与文档「85 以下建议改写」对齐）
    multi_agent_deliverability_rewrite_below: int = 85
    # 改写后二次审核仍低于该分，或仍为 high risk（且 strict 开启）→ 回退确定性组装
    multi_agent_deliverability_min_score: int = 70
    multi_agent_deliverability_strict: bool = True

    # Aliyun DirectMail SMTP
    smtp_host: str = "smtpdm.aliyun.com"
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = "AI Pulse <noreply@example.com>"
    # If true, do not send real emails; only log.
    mail_dry_run: bool = False
    # 可选：仅用环境变量限制测试收件人（推荐改用命令行 send_weekly --test）
    weekly_send_test_mode: bool = False
    weekly_test_inbox: str = "test@example.com"
    # 进阶：手动指定单收件人（仅当未开 weekly_send_test_mode 时生效）
    target_email: str = ""

    # RSS sources (comma-separated URLs optional override)
    # - official_rss_urls: AI 公司官网/博客 RSS（优先级高）
    # - media_rss_urls: 行业媒体 RSS（如 机器之心/量子位/InfoQ 等）
    # - x_rss_urls: X/Twitter 账号 RSS（建议用 RSSHub/Nitter 生成 RSS URL；避免依赖付费 X API）
    # - meta_rss_urls: Meta AI Blog 等（可直接放 RSSHub /meta/ai/blog，不混在 X）
    # - community_rss_urls: HN / Reddit / 等社区 RSS（P3，tier=3）
    # - product_rss_urls: Product Hunt 等「产品/上新」类 RSS（tier=2）
    # - official_page_urls: 仅列表页/HTML，尝试发现 <link rel="alternate" type="rss|atom"> 再抓 RSS
    # - crawl_priority: 采集顺序，逗号分隔，例如 official,media,github,product,community
    official_rss_urls: str = ""
    media_rss_urls: str = ""
    x_rss_urls: str = ""
    meta_rss_urls: str = ""
    community_rss_urls: str = ""
    product_rss_urls: str = ""
    official_page_urls: str = ""
    crawl_priority: str = "official,meta,media,product,community,x,github"

    # GitHub (optional) — used for Trending collection and metadata
    github_token: str = ""
    # Search API 回退：仓库创建时间窗口（天），与 PRD「约 180 天内」对齐
    github_search_created_within_days: int = 180
    # Search API：stars 下限（PRD 建议 >=500；过高会漏掉早期优质库）
    github_search_min_stars: int = 500
    # 仅保留描述/标题命中 AI 相关关键词的仓库（GitHub Search 回退路径）
    github_ai_keyword_filter: bool = True
    github_trending_since_days: int = 7
    # 兼容旧名：若高于 github_search_min_stars，Search API 查询会采用更高下限
    github_trending_min_stars_growth: int = 500
    github_trending_language: str = ""  # empty = all

    # Daily rankings — Phase 2.5 Ranking Insight Agent（需 LLM_API_* 或 DOUBAO_*；关闭或未配置时跳过）
    # .env 键名：RANKING_INSIGHT_ENABLED / RANKING_INSIGHT_LIMIT / RANKING_INSIGHT_BATCH_SIZE /
    # RANKING_INSIGHT_TIMEOUT_SECONDS
    ranking_insight_enabled: bool = Field(default=False)
    ranking_insight_limit: int = Field(default=30)
    ranking_insight_batch_size: int = Field(default=8)
    ranking_insight_timeout_seconds: float = Field(default=180.0, ge=15.0, le=600.0)

    # Phase 3：周报选题来源（仅支持 global_events；legacy 已从 generate_weekly 移除）
    # .env 键名：WEEKLY_SOURCE、GLOBAL_EVENTS_*（见 pydantic-settings 默认大写映射）
    weekly_source: str = Field(default="global_events")
    global_events_lookback_days: int = Field(default=7)
    global_events_min_candidates: int = Field(default=8)
    global_events_fallback_lookback_days: int = Field(default=14)
    global_events_pool_limit: int = Field(default=40)

    # Deprecated: merge 在入库后由 issue_events 表持久化完成；保留字段仅为兼容旧 .env。
    enable_event_merge: bool = False

    # 周刊邮件追踪：HMAC 签名 token；为空则不注入像素与重定向链接
    tracking_hmac_secret: str = ""

    # Admin auth
    admin_jwt_secret: str = ""
    admin_jwt_expires_hours: int = 24
    # Optional: admin console origin for CORS (e.g. https://admin.example.com)
    admin_frontend_url: str = ""

    @staticmethod
    def _split_urls(s: str) -> list[str]:
        return [_sanitize_list_url(u) for u in (s or "").split(",") if u.strip()]

    _CRAWL_KEYS: tuple[str, ...] = ("official", "meta", "media", "product", "community", "x", "github")

    def crawl_priority_order(self) -> list[str]:
        """解析 CRAWL_PRIORITY；未出现的类别按默认顺序补全。"""
        raw = [x.strip().lower() for x in (self.crawl_priority or "").split(",") if x.strip()]
        seen: set[str] = set()
        out: list[str] = []
        for x in raw:
            if x in self._CRAWL_KEYS and x not in seen:
                out.append(x)
                seen.add(x)
        for x in self._CRAWL_KEYS:
            if x not in seen:
                out.append(x)
        return out

    def _feed_bucket(self, key: str) -> tuple[int, list[str], str]:
        """tier, urls, feed_channel（传给 fetch_feed_items）"""
        if key == "official":
            return 0, self._split_urls(self.official_rss_urls), "official"
        if key == "meta":
            return 0, self._split_urls(self.meta_rss_urls), "meta"
        if key == "media":
            return 1, self._split_urls(self.media_rss_urls), "media"
        if key == "product":
            return 2, self._split_urls(self.product_rss_urls), "product"
        if key == "community":
            return 3, self._split_urls(self.community_rss_urls), "community"
        if key == "x":
            return 4, self._split_urls(self.x_rss_urls), "x"
        return 0, [], "official"

    def feed_sources_with_metadata(self) -> List[Tuple[int, str, str]]:
        """
        按 CRAWL_PRIORITY 展开 RSS（不含 github、不含 official_page 发现）。
        tier：official/meta=0, media=1, product=2, community=3, x=4
        """
        out: list[tuple[int, str, str]] = []
        for key in self.crawl_priority_order():
            if key == "github":
                continue
            tier, urls, ch = self._feed_bucket(key)
            for u in urls:
                out.append((tier, u, ch))
        return out

    def feed_sources_with_tier(self) -> List[Tuple[int, str]]:
        """
        PRD §五 来源优先级：P0 官网 / P1 媒体 / P2 GitHub（爬虫中单列）/ P4 社媒。
        返回 (tier, feed_url)，tier 越小越可信，用于评分加权。
        """
        return [(t, u) for t, u, _ in self.feed_sources_with_metadata()]

    @property
    def feed_list(self) -> List[str]:
        official = self._split_urls(self.official_rss_urls)
        media = self._split_urls(self.media_rss_urls)
        xfeeds = self._split_urls(self.x_rss_urls)
        meta = self._split_urls(self.meta_rss_urls)
        community = self._split_urls(self.community_rss_urls)
        product = self._split_urls(self.product_rss_urls)
        return official + media + xfeeds + meta + community + product


@lru_cache
def get_settings() -> Settings:
    """
    进程内缓存 Settings 实例。修改 .env 后须重启 uvicorn / 任务进程，
    或调用 ``get_settings.cache_clear()`` 再取新配置。
    """
    return Settings()
