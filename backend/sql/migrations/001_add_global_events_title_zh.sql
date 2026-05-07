-- MySQL：GlobalEvent 英文标题译文（豆包写入）
-- 执行：mysql ... < 001_add_global_events_title_zh.sql
--
-- 若报错 Duplicate column name 'title_zh'：说明列已存在，无需再执行。
-- 验证：SHOW COLUMNS FROM global_events LIKE 'title_zh';

ALTER TABLE global_events
  ADD COLUMN title_zh VARCHAR(512) NOT NULL DEFAULT '' AFTER canonical_title;
