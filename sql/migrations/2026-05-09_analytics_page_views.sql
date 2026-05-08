-- 站内 PV/UV 埋点（仅存 ip_hash，不存明文 IP）
USE aipulse;

CREATE TABLE IF NOT EXISTS analytics_page_views (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(40) NOT NULL,
  session_id VARCHAR(40) NULL,
  path VARCHAR(512) NOT NULL,
  referrer VARCHAR(1024) NULL,
  user_agent VARCHAR(512) NULL,
  ip_hash VARCHAR(64) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_apv_created (created_at),
  KEY ix_apv_visitor (visitor_id),
  KEY ix_apv_path (path(191)),
  KEY ix_apv_ip_hash (ip_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
