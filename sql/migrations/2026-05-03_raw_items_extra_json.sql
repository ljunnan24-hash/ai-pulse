-- PRD：RawItem 扩展字段（爬虫元数据、metrics 等）
--   USE aipulse;
--   SOURCE sql/migrations/2026-05-03_raw_items_extra_json.sql;

ALTER TABLE raw_items
  ADD COLUMN extra_json TEXT NOT NULL AFTER score_breakdown_json;
