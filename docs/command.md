https://github.com/ljunnan24-hash/ai-pulse

进MySQL命令：
mysql -h rm-j6cxyfcxz4or910uo.mysql.rds.aliyuncs.com -P 3306 -u aipulse1 -p aipulse

cd /opt/ai-pulse
git pull --ff-only origin main
cd backend

给测试邮箱发周报：在服务器上（已 cd /opt/ai-pulse/backend、虚拟环境已激活）时
.venv/bin/python -m app.jobs.send_weekly --test

重新生成本周刊物：
.venv/bin/python -m app.jobs.generate_weekly --force

若不想重新爬 RSS，可：
.venv/bin/python -m app.jobs.generate_weekly --reuse-crawl 

重启服务：
sudo systemctl restart aipulse-api
sudo systemctl status aipulse-api --no-pager

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