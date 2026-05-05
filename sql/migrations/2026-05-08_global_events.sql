-- 全局排行榜事件（跨周刊周期）。每日抓取 raw_items (issue_id NULL) 合并到此表。
USE aipulse;

CREATE TABLE IF NOT EXISTS global_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  stable_key VARCHAR(96) NOT NULL,
  canonical_title VARCHAR(512) NOT NULL DEFAULT '',
  canonical_url VARCHAR(2048) NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'application',
  source_type VARCHAR(32) NOT NULL DEFAULT 'rss',
  published_at DATETIME(6) NULL,
  first_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  source_count INT NOT NULL DEFAULT 1,
  heat_score INT NOT NULL DEFAULT 0,
  freshness_score DOUBLE NOT NULL DEFAULT 50,
  trust_score DOUBLE NOT NULL DEFAULT 50,
  user_value_score DOUBLE NOT NULL DEFAULT 50,
  trend_score DOUBLE NOT NULL DEFAULT 50,
  weekly_score DOUBLE NOT NULL DEFAULT 0,
  ranking_score DOUBLE NOT NULL DEFAULT 0,
  action_suggestion VARCHAR(32) NOT NULL DEFAULT '先观望',
  what_happened VARCHAR(512) NOT NULL DEFAULT '',
  why_important VARCHAR(1024) NOT NULL DEFAULT '',
  what_it_means_for_you VARCHAR(1024) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  sources_json LONGTEXT NOT NULL,
  metrics_json LONGTEXT NOT NULL,
  capability_tags_json LONGTEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_global_events_stable (stable_key),
  KEY ix_ge_last_seen (last_seen_at),
  KEY ix_ge_published (published_at),
  KEY ix_ge_category (category),
  KEY ix_ge_ranking (ranking_score),
  KEY ix_ge_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS global_event_sources (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  global_event_id BIGINT NOT NULL,
  raw_item_id BIGINT NOT NULL,
  source_name VARCHAR(256) NOT NULL DEFAULT '',
  source_type VARCHAR(32) NOT NULL DEFAULT '',
  url VARCHAR(2048) NOT NULL DEFAULT '',
  published_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_ges_event_raw (global_event_id, raw_item_id),
  KEY ix_ges_raw (raw_item_id),
  CONSTRAINT fk_ges_global FOREIGN KEY (global_event_id) REFERENCES global_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_ges_raw FOREIGN KEY (raw_item_id) REFERENCES raw_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
