-- AI Pulse — MySQL 8 (utf8mb4). Run on RDS before first deploy.

CREATE DATABASE IF NOT EXISTS aipulse DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aipulse;

CREATE TABLE IF NOT EXISTS subscribers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  mode VARCHAR(16) NOT NULL DEFAULT 'normal',
  keywords_json TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  confirm_token VARCHAR(64) NOT NULL,
  unsubscribe_token VARCHAR(64) NOT NULL,
  manage_token VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  confirmed_at DATETIME(6) NULL,
  UNIQUE KEY uk_subscribers_email (email),
  UNIQUE KEY uk_subscribers_confirm (confirm_token),
  UNIQUE KEY uk_subscribers_unsub (unsubscribe_token),
  UNIQUE KEY uk_subscribers_manage (manage_token),
  KEY ix_subscribers_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS weekly_issues (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  period_start DATE NOT NULL,
  simple_text TEXT NOT NULL,
  normal_text TEXT NOT NULL,
  glossary_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  ready_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_weekly_issue_period (period_start),
  KEY ix_weekly_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS weekly_issue_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  issue_id BIGINT NOT NULL,
  period_start DATE NOT NULL,
  simple_text TEXT NOT NULL,
  normal_text TEXT NOT NULL,
  glossary_json TEXT NOT NULL,
  payload_json LONGTEXT NOT NULL,
  status VARCHAR(16) NOT NULL,
  ready_at DATETIME(6) NULL,
  source VARCHAR(64) NOT NULL,
  audit_report_json LONGTEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_wis_issue FOREIGN KEY (issue_id) REFERENCES weekly_issues (id) ON DELETE CASCADE,
  KEY ix_wis_issue_created (issue_id, created_at),
  KEY ix_wis_period_created (period_start, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS issue_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  issue_id BIGINT NOT NULL,
  event_key VARCHAR(32) NOT NULL,
  canonical_title VARCHAR(512) NOT NULL DEFAULT '',
  canonical_url VARCHAR(1024) NOT NULL DEFAULT '',
  summary_merged TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT '',
  fact_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  confidence DOUBLE NOT NULL DEFAULT 0,
  score_total INT NOT NULL DEFAULT 0,
  heat_score INT NOT NULL DEFAULT 0,
  published_at DATETIME(6) NULL,
  sources_json TEXT NOT NULL,
  enrichment_json TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_issue_events_issue FOREIGN KEY (issue_id) REFERENCES weekly_issues (id) ON DELETE CASCADE,
  UNIQUE KEY uk_issue_event_key (issue_id, event_key),
  KEY ix_issue_events_issue (issue_id),
  KEY ix_issue_events_score (score_total)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS raw_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  issue_id BIGINT NULL,
  event_id BIGINT NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'rss',
  source VARCHAR(128) NOT NULL DEFAULT '',
  title VARCHAR(512) NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  link VARCHAR(1024) NOT NULL DEFAULT '',
  published_at DATETIME(6) NULL,
  heat_score INT NOT NULL DEFAULT 0,
  score_total INT NOT NULL DEFAULT 0,
  score_breakdown_json TEXT NOT NULL,
  extra_json TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_raw_issue (issue_id),
  KEY ix_raw_event (event_id),
  KEY ix_raw_score_total (score_total),
  CONSTRAINT fk_raw_issue FOREIGN KEY (issue_id) REFERENCES weekly_issues(id) ON DELETE SET NULL,
  CONSTRAINT fk_raw_event FOREIGN KEY (event_id) REFERENCES issue_events(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS send_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subscriber_id BIGINT NOT NULL,
  issue_id BIGINT NULL,
  kind VARCHAR(255) NOT NULL DEFAULT 'weekly',
  sent_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_send_sub (subscriber_id),
  KEY ix_send_issue (issue_id),
  CONSTRAINT fk_send_sub FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
  CONSTRAINT fk_send_issue FOREIGN KEY (issue_id) REFERENCES weekly_issues(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  last_login_at DATETIME(6) NULL,
  UNIQUE KEY uk_admin_users_username (username),
  KEY ix_admin_users_active (is_active)
) ENGINE=InnoDB;

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
) ENGINE=InnoDB;

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
