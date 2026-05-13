-- 每日 RSS 抓取健康明细（与 daily_rankings 任务对齐，按 run_id 批量写入）。
USE aipulse;

CREATE TABLE IF NOT EXISTS feed_crawl_runs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL,
  job_name VARCHAR(64) NOT NULL DEFAULT '',
  feed_url VARCHAR(2048) NOT NULL DEFAULT '',
  feed_channel VARCHAR(64) NOT NULL DEFAULT '',
  http_status INT NULL,
  content_type VARCHAR(512) NULL,
  fetch_ok TINYINT(1) NOT NULL DEFAULT 0,
  parse_ok TINYINT(1) NOT NULL DEFAULT 0,
  raw_entry_count INT NOT NULL DEFAULT 0,
  emitted_item_count INT NOT NULL DEFAULT 0,
  inserted_item_count INT NULL,
  health_status VARCHAR(32) NOT NULL DEFAULT '',
  error_class VARCHAR(128) NULL,
  error_message TEXT NULL,
  duration_ms INT NOT NULL DEFAULT 0,
  run_at DATETIME(6) NOT NULL,
  KEY ix_feed_crawl_run_id (run_id),
  KEY ix_feed_crawl_run_at (run_at),
  KEY ix_feed_crawl_feed_url (feed_url(255)),
  KEY ix_feed_crawl_health (health_status, run_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
