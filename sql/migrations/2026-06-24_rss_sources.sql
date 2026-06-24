-- 后台可管理 RSS 信源；为空时爬虫回退到 .env 的 RSS 配置。
USE aipulse;

CREATE TABLE IF NOT EXISTS rss_sources (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(256) NOT NULL DEFAULT '',
  url VARCHAR(2048) NOT NULL DEFAULT '',
  url_hash VARCHAR(64) NOT NULL,
  channel VARCHAR(64) NOT NULL DEFAULT 'official',
  tier INT NOT NULL DEFAULT 0,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  note TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_rss_sources_url_hash (url_hash),
  KEY ix_rss_sources_channel (channel),
  KEY ix_rss_sources_tier (tier),
  KEY ix_rss_sources_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
