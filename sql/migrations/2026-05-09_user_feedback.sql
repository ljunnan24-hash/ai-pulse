-- 用户建议反馈（关于页等）
USE aipulse;

CREATE TABLE IF NOT EXISTS user_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  content TEXT NOT NULL,
  contact VARCHAR(120) NULL,
  source_page VARCHAR(512) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  admin_note TEXT NULL,
  user_agent VARCHAR(512) NULL,
  ip_hash VARCHAR(64) NULL,
  visitor_id VARCHAR(40) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY ix_uf_status (status),
  KEY ix_uf_created (created_at),
  KEY ix_uf_ip_hash (ip_hash),
  KEY ix_uf_visitor (visitor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
