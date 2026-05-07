-- MySQL：GlobalEvent 英文标题译文（豆包写入）
-- 执行：mysql ... < 001_add_global_events_title_zh.sql

ALTER TABLE global_events
  ADD COLUMN title_zh VARCHAR(512) NOT NULL DEFAULT '' AFTER canonical_title;
