-- RawItem 入库去重：规范化 URL 与哈希（无 UNIQUE，兼容历史重复行）
USE aipulse;

ALTER TABLE raw_items
  ADD COLUMN normalized_link VARCHAR(2048) NULL AFTER link,
  ADD COLUMN normalized_link_hash CHAR(64) NULL AFTER normalized_link,
  ADD KEY ix_raw_norm_hash (normalized_link_hash),
  ADD KEY ix_raw_norm_link (normalized_link(255));
