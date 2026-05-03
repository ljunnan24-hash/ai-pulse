-- 周刊每次生成成功追加一行快照（同一 period 多次 --force 可有多条），便于排查历史版本。
-- USE aipulse;

CREATE TABLE IF NOT EXISTS weekly_issue_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  issue_id BIGINT NOT NULL,
  period_start DATE NOT NULL,
  simple_text TEXT NOT NULL,
  normal_text TEXT NOT NULL,
  glossary_json TEXT NOT NULL,
  payload_json LONGTEXT NOT NULL,
  status VARCHAR(16) NOT NULL,
  ready_at DATETIME(6) NULL,
  source VARCHAR(64) NOT NULL COMMENT 'generate_weekly | generate_weekly_force | build_weekly_multi_agent',
  audit_report_json LONGTEXT NULL COMMENT 'multi-agent / deliverability 审计 JSON',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_wis_issue FOREIGN KEY (issue_id) REFERENCES weekly_issues (id) ON DELETE CASCADE,
  KEY ix_wis_issue_created (issue_id, created_at),
  KEY ix_wis_period_created (period_start, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
