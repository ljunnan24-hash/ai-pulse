-- 榜单事件兴趣埋点：匿名记录排行榜曝光 / 点击，用于标题、来源、位置偏好分析。
USE aipulse;

CREATE TABLE IF NOT EXISTS analytics_ranking_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(40) NOT NULL,
  session_id VARCHAR(40) NULL,
  action VARCHAR(24) NOT NULL,
  event_id BIGINT NULL,
  event_key VARCHAR(128) NULL,
  surface VARCHAR(64) NOT NULL DEFAULT '',
  range_key VARCHAR(32) NULL,
  rank_position INT NULL,
  category VARCHAR(64) NULL,
  title_snapshot VARCHAR(512) NOT NULL DEFAULT '',
  title_en_snapshot VARCHAR(512) NULL,
  source_label VARCHAR(256) NULL,
  source_type VARCHAR(32) NULL,
  path VARCHAR(512) NULL,
  target_url VARCHAR(1024) NULL,
  referrer VARCHAR(1024) NULL,
  user_agent VARCHAR(512) NULL,
  ip_hash VARCHAR(64) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_are_created (created_at),
  KEY ix_are_visitor (visitor_id),
  KEY ix_are_action_created (action, created_at),
  KEY ix_are_event_created (event_id, created_at),
  KEY ix_are_event_key (event_key),
  KEY ix_are_surface_created (surface, created_at),
  KEY ix_are_range_created (range_key, created_at),
  KEY ix_are_source_created (source_label(191), created_at),
  KEY ix_are_ip_hash (ip_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
