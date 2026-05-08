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

重启服务：
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