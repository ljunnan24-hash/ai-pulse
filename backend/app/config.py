from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "mysql+pymysql://root:password@127.0.0.1:3306/aipulse?charset=utf8mb4"

    public_app_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Volcengine Ark (豆包) — OpenAI-compatible chat completions
    doubao_api_key: str = ""
    doubao_api_base: str = "https://ark.cn-beijing.volces.com/api/v3"
    doubao_model: str = ""

    # Aliyun DirectMail SMTP
    smtp_host: str = "smtpdm.aliyun.com"
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = "AI Pulse <noreply@example.com>"

    # RSS sources (comma-separated URLs optional override)
    rss_feed_urls: str = ""

    @property
    def feed_list(self) -> List[str]:
        default = [
            "https://openai.com/blog/rss.xml",
            "https://www.jiqizhixin.com/rss",
            "https://www.qbitai.com/feed",
        ]
        if not self.rss_feed_urls.strip():
            return default
        return [u.strip() for u in self.rss_feed_urls.split(",") if u.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
