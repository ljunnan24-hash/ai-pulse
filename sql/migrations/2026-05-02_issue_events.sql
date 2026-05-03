-- IssueEvent: 同一事实多源聚合并持久化；raw_items 通过 event_id 关联
-- MySQL 8:
--   USE aipulse;
--   SOURCE sql/migrations/2026-05-02_issue_events.sql;

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
  enrichment_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_issue_events_issue FOREIGN KEY (issue_id) REFERENCES weekly_issues (id) ON DELETE CASCADE,
  UNIQUE KEY uk_issue_event_key (issue_id, event_key),
  KEY ix_issue_events_issue (issue_id),
  KEY ix_issue_events_score (score_total)
) ENGINE=InnoDB;

ALTER TABLE raw_items
  ADD COLUMN event_id BIGINT NULL AFTER issue_id,
  ADD KEY ix_raw_event (event_id),
  ADD CONSTRAINT fk_raw_event FOREIGN KEY (event_id) REFERENCES issue_events (id) ON DELETE SET NULL;
