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
