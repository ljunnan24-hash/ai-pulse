-- 周报事件周评分（按 period_start + global_event_id 唯一；weekly_score 为新版周报 Top3 排序依据）
USE aipulse;

CREATE TABLE IF NOT EXISTS weekly_event_scores (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  global_event_id BIGINT NOT NULL,
  weekly_score DOUBLE NOT NULL DEFAULT 0,
  max_pulse_score DOUBLE NOT NULL DEFAULT 0,
  independent_source_count INT NOT NULL DEFAULT 0,
  active_days INT NOT NULL DEFAULT 0,
  source_boost DOUBLE NOT NULL DEFAULT 0,
  active_day_boost DOUBLE NOT NULL DEFAULT 0,
  authority_boost DOUBLE NOT NULL DEFAULT 0,
  new_development_boost DOUBLE NOT NULL DEFAULT 0,
  has_official_source TINYINT(1) NOT NULL DEFAULT 0,
  has_authority_media TINYINT(1) NOT NULL DEFAULT 0,
  score_reasons JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uk_wes_period_event (period_start, global_event_id),
  KEY ix_wes_report_date (report_date),
  KEY ix_wes_period_score (period_start, weekly_score),
  KEY ix_wes_global_event (global_event_id),
  CONSTRAINT fk_wes_global_event FOREIGN KEY (global_event_id) REFERENCES global_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
