-- 公开周报页：按日期 upsert，同日重复生成覆盖更新。
USE aipulse;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_date DATE NOT NULL,
  slug VARCHAR(32) NOT NULL DEFAULT '',
  title VARCHAR(512) NOT NULL DEFAULT '',
  payload_json LONGTEXT NOT NULL,
  html_content LONGTEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  published_at DATETIME(6) NULL,
  UNIQUE KEY uk_weekly_reports_date (report_date),
  KEY ix_weekly_reports_status (status)
) ENGINE=InnoDB;
