-- Migration: add multi-source + scoring fields for raw_items
-- Run on MySQL 8:
--   USE aipulse;
--   SOURCE sql/migrations/2026-04-24_add_scoring_and_sources.sql;

ALTER TABLE raw_items
  ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'rss' AFTER issue_id,
  ADD COLUMN score_total INT NOT NULL DEFAULT 0 AFTER heat_score,
  ADD COLUMN score_breakdown_json TEXT NOT NULL AFTER score_total;

CREATE INDEX ix_raw_score_total ON raw_items (score_total);
