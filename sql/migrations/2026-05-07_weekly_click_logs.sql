-- 周刊邮件/页面点击与打开追踪（最小埋点）
USE aipulse;

CREATE TABLE IF NOT EXISTS weekly_click_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  subscriber_id BIGINT NULL,
  weekly_issue_id BIGINT NULL,
  report_date DATE NULL,
  event_type VARCHAR(16) NOT NULL,
  click_target VARCHAR(32) NULL,
  top3_slot TINYINT NULL,
  dest_url VARCHAR(2048) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY ix_wcl_subscriber (subscriber_id),
  KEY ix_wcl_issue (weekly_issue_id),
  KEY ix_wcl_report_date (report_date),
  KEY ix_wcl_event (event_type),
  KEY ix_wcl_created (created_at),
  CONSTRAINT fk_wcl_subscriber FOREIGN KEY (subscriber_id) REFERENCES subscribers (id) ON DELETE SET NULL,
  CONSTRAINT fk_wcl_issue FOREIGN KEY (weekly_issue_id) REFERENCES weekly_issues (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
