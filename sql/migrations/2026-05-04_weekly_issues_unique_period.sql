-- 防止同一周一有多条 weekly_issues（并发 cron / 重复跑任务会导致 StaleDataError）
-- 执行前请先清理重复数据（保留每个 period_start 最小 id）：
--
-- DELETE t1 FROM weekly_issues t1
-- INNER JOIN weekly_issues t2
--   ON t1.period_start = t2.period_start AND t1.id > t2.id;
--
-- 若存在孤儿 raw_items 指向被删期次，需手工处理后再删重复行。

ALTER TABLE weekly_issues
  ADD UNIQUE KEY uk_weekly_issue_period (period_start);
