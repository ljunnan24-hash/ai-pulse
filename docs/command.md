https://github.com/ljunnan24-hash/ai-pulse

进MySQL命令：
mysql -h rm-j6cxyfcxz4or910uo.mysql.rds.aliyuncs.com -P 3306 -u aipulse1 -p aipulse

cd /opt/ai-pulse
git pull --ff-only origin main
cd backend

给测试邮箱发周报：在服务器上（已 cd /opt/ai-pulse/backend、虚拟环境已激活）时
.venv/bin/python -m app.jobs.send_weekly --test

重新生成本周刊物：
WEEKLY_SOURCE=global_events .venv/bin/python -m app.jobs.generate_weekly --force

若不想重新爬 RSS，可：
cd C:\Users\Lenovo\Desktop\ai-pulse\backend
$env:WEEKLY_SOURCE="global_events"
.\.venv\Scripts\python.exe -m app.jobs.generate_weekly --reuse-crawl --force

重启后端：
sudo systemctl restart aipulse-api
sudo systemctl status aipulse-api --no-pager

改前端（**build 后必须把 dist 拷到 Nginx 站点根目录**，仅 reload 不会更新线上 HTML）：

cd /opt/ai-pulse
npm ci && npm run build
sudo rm -rf /var/www/aipulse/*
sudo cp -r dist/* /var/www/aipulse/
sudo nginx -t && sudo systemctl reload nginx

验收（两处 JS 哈希应一致）：

grep -o 'assets/index-[^"]*\.js' /var/www/aipulse/index.html
curl -sS https://aipulse.asia/ | grep -o 'assets/index-[^"]*\.js'

## Crontab（与仓库 `deploy/crontab.example` 一致）

**所有示例时间均为中国东部时间**：在 crontab 顶部写 **`TZ=Asia/Shanghai`**（上海），与「北京时间」相同；或把服务器系统时区设为 `Asia/Shanghai`。

| 时间（上海 / 北京，UTC+8） | 任务 |
|------------------|------|
| 每日 **02:10** | `daily_rankings`（爬虫 + raw_items + global_events） |
| 每日 **02:40** | `enrich_rankings`（依赖 `.env` `RANKING_INSIGHT_ENABLED`，可注释掉） |
| 周一 **04:10** | `generate_weekly`（须晚于当日日报流水线） |
| 周一 **05:00** | `send_weekly`（须晚于上一行生成） |

完整可复制片段（含 `flock`、日志路径）见 **`deploy/crontab.example`**。编辑后 **`sudo crontab -l`**（若用 root 跑 cron）核对。

---

## 验收数据链路（global_events / daily_rankings / API / SPA）

1）迁移并确认表：

mysql ... < sql/migrations/2026-05-08_global_events.sql
SHOW TABLES LIKE 'global_events';
SHOW TABLES LIKE 'global_event_sources';

2）跑每日任务并计数：

cd /opt/ai-pulse/backend
.venv/bin/python -m app.jobs.daily_rankings

**Ranking Insight 生产建议（`.env`）**：`RANKING_INSIGHT_LIMIT=10`、`RANKING_INSIGHT_BATCH_SIZE=4`、`RANKING_INSIGHT_TIMEOUT_SECONDS=180`。

仅补跑 Insight（不爬 RSS、不写 raw_items）：

```bash
cd /opt/ai-pulse/backend
.venv/bin/python -m app.jobs.enrich_rankings --limit 10
.venv/bin/python -m app.jobs.enrich_rankings --limit 10 --force
```

SELECT COUNT(*) FROM raw_items WHERE issue_id IS NULL;
SELECT COUNT(*) FROM global_events;
SELECT COUNT(*) FROM global_event_sources;

3）测 API（把域名换成你的）：

curl -s "https://你的域名/api/rankings?range=today&category=all&limit=5"
curl -s "https://你的域名/api/events/1"
curl -s "https://你的域名/api/weekly/latest"
curl -s "https://你的域名/api/archive?limit=10"

4）浏览器依次打开（应由 SPA 渲染，不应无故跳首页）：

/   /rankings   /events/1   /weekly/latest   /archive

5）Nginx 建议：`/api/`、`/health`、`/manage/*`、后台所需 `/admin/auth` 等 → 后端；**其余（含 `/weekly/*`）→ 前端静态 SPA**。邮件里的 `weekly_url` 仍为 `/weekly/日期`，由 React 读 `/api/weekly/*`；若需旧的服务端 HTML 周报，路径为 **`/weekly-html/日期`**（直连后端时）。

当前不必做：付费、复杂权限、个性化、雷达完整 Agent、B 端。

---

## RawItem 入库去重（规范化 URL）

- 行为说明见 **`docs/去重机制说明.md`**（源级仍全量请求、item/入库去重、`GlobalEvent` 为另一层；ETag/feed_state 为后续项）。
- 首次需执行迁移（与现有库兼容，无 UNIQUE）：

```bash
mysql -h … -u … -p aipulse < sql/migrations/2026-05-15_raw_items_dedupe_columns.sql
```

---

## RSS 信源健康（`feed_crawl_runs`）

`daily_rankings` 每次跑完会按 `run_id` 批量写入各 `feed_url` 的抓取报告；控制台抓取过程中有 `[feed-health]` 前缀摘要。

**迁移（首次部署）：**

```bash
mysql -h … -u … -p aipulse < sql/migrations/2026-05-14_feed_crawl_runs.sql
```

**1）最近一次任务里，每个 RSS 源是否成功（取最新 `run_at` 那一批 `run_id`）：**

```sql
SELECT run_id, MAX(run_at) AS run_at
FROM feed_crawl_runs
WHERE job_name = 'daily_rankings'
GROUP BY run_id
ORDER BY run_at DESC
LIMIT 1;
-- 将上一步得到的 run_id 代入：
SELECT feed_url, feed_channel, health_status, http_status, content_type,
       raw_entry_count, emitted_item_count, inserted_item_count, error_message
FROM feed_crawl_runs
WHERE run_id = '上一步的 run_id'
ORDER BY feed_channel, feed_url;
```

**2）最近 7 天「失败」最多的源（`health_status` 非 `ok`）：**

```sql
SELECT feed_url, feed_channel, health_status, COUNT(*) AS fail_cnt
FROM feed_crawl_runs
WHERE job_name = 'daily_rankings'
  AND run_at >= NOW(6) - INTERVAL 7 DAY
  AND health_status <> 'ok'
GROUP BY feed_url, feed_channel, health_status
ORDER BY fail_cnt DESC
LIMIT 30;
```

**3）HTTP 200 但判定不是 RSS（`invalid_feed`，多为 `text/html` 占位页）：**

```sql
SELECT run_at, feed_url, feed_channel, http_status, content_type, error_message
FROM feed_crawl_runs
WHERE health_status = 'invalid_feed'
ORDER BY run_at DESC
LIMIT 50;
```

**4）按 `feed_url` 汇总最近 7 天各状态次数 + 最近一次详情（MySQL 8+）：**

```sql
WITH w AS (
  SELECT
    feed_channel,
    feed_url,
    run_id,
    run_at,
    health_status,
    http_status,
    content_type,
    error_message,
    error_class,
    ROW_NUMBER() OVER (PARTITION BY feed_channel, feed_url ORDER BY run_at DESC) AS rn
  FROM feed_crawl_runs
  WHERE job_name = 'daily_rankings'
    AND run_at >= NOW(6) - INTERVAL 7 DAY
)
SELECT
  a.feed_channel,
  a.feed_url,
  a.total_runs,
  a.ok_count,
  a.no_new_items_count,
  a.invalid_feed_count,
  a.fetch_failed_count,
  a.parse_failed_count,
  a.empty_feed_count,
  a.all_filtered_count,
  x.health_status AS last_status,
  x.http_status AS last_http_status,
  x.content_type AS last_content_type,
  COALESCE(NULLIF(x.error_message, ''), x.error_class) AS last_error,
  x.run_at AS last_seen_at
FROM (
  SELECT
    feed_channel,
    feed_url,
    COUNT(*) AS total_runs,
    SUM(health_status = 'ok') AS ok_count,
    SUM(health_status = 'no_new_items') AS no_new_items_count,
    SUM(health_status = 'invalid_feed') AS invalid_feed_count,
    SUM(health_status = 'fetch_failed') AS fetch_failed_count,
    SUM(health_status = 'parse_failed') AS parse_failed_count,
    SUM(health_status = 'empty_feed') AS empty_feed_count,
    SUM(health_status = 'all_filtered') AS all_filtered_count
  FROM w
  GROUP BY feed_channel, feed_url
) a
JOIN w x
  ON x.feed_channel = a.feed_channel
 AND x.feed_url = a.feed_url
 AND x.rn = 1
ORDER BY a.feed_channel, a.feed_url;
```

**5）RSS 治理脚本（读 `DATABASE_URL`，输出表格 + `reports/rss_source_governance.json`）：**

```bash
cd /opt/ai-pulse/backend
.venv/bin/python scripts/rss_source_governance.py
.venv/bin/python scripts/rss_source_governance.py --days 14 --min-runs-for-remove 3
```

**6）验证候选 RSS（stdlib，不依赖 feedparser）：**

```bash
cd /opt/ai-pulse/backend
.venv/bin/python scripts/verify_feeds_stdlib.py --nvidia-defaults
.venv/bin/python scripts/verify_feeds_stdlib.py --check-url https://example.com/feed.xml
```

治理结论与生产 `.env` 手動片段见 **`docs/rss源治理记录.md`**。