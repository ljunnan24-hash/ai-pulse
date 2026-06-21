# 定时任务审计（内部记录）

> 当前推荐 cron 以 [`../../deploy/crontab.example`](../../deploy/crontab.example) 为准；完整链路说明见 [`../PIPELINE_AND_OBSERVABILITY.md`](../PIPELINE_AND_OBSERVABILITY.md)。

以下为仓库内 **job 入口** 与 **推荐 crontab**（详见 `deploy/crontab.example`）。实际命令与路径以部署环境为准。

| 任务 | 模块入口 | 外部依赖 | 写库 | 邮件 | 原示例时间 | 现推荐（上海 Asia/Shanghai，同北京 UTC+8） |
|------|-----------|----------|------|------|------------|---------------------|
| 每日排行榜 / 抓取合并 | `python -m app.jobs.daily_rankings` | RSS/GitHub 等抓取 | 是（raw_items、global_events） | 否 | 每日 08:00 | **02:10** |
| Ranking Insight | `python -m app.jobs.enrich_rankings` | LLM（若开启） | 是（metrics_json 等） | 否 | （未统一） | **02:40** |
| 周报生成 | `python -m app.jobs.generate_weekly` | `WEEKLY_SOURCE=global_events` 时：**不抓周刊 RSS**；Top3=`weekly_score` 前 3；**3×LLM**（thesis + capability + glossary）。分数口径见 `docs/SCORE_AND_RANKING.md`。legacy 仍为抓取 + 多 Agent | 是 | 否 | 周一 00:30 | **周一 04:10**（晚于每日 02:10 抓取） |
| 周报发送 | `python -m app.jobs.send_weekly` | SMTP | 是（send_logs） | **是** | 周一 09:00 | **周一 05:00**（须晚于周报生成） |

其它脚本（按需手工执行，默认不进 crontab）：`recalculate_global_events`、`build_weekly_multi_agent`、`backfill_title_zh`、`dedupe_event_sources` 等。

### 运行安全（约定）

- Job **独立进程**：失败不应拖垮 uvicorn；日志写入文件或 stderr。
- **`flock`**：避免同一 job 重叠。
- **爬虫**：采集逻辑应在服务层带超时/重试（见 `crawler_service`）；job 层捕获异常并退出非零便于监控。
- **事务**：ORM `commit` 由现有 service 控制；job 内异常时 `rollback`。

### 时区（统一上海时间）

推荐在 **`deploy/crontab.example` 首段保留 `TZ=Asia/Shanghai`**：其后各行的「分 / 时」均按**上海（中国东部）**解释，与日常说的「北京时间」一致。  
亦可 `timedatectl set-timezone Asia/Shanghai` 设系统时区；若主机为 UTC，仅靠 crontab 内 **`TZ=Asia/Shanghai`** 一行即可，无需改系统时钟。

### 生产反代与路由（避免 /admin 冲突）

- **前端 SPA**：浏览器路径 **`/admin`、`/admin/analytics`、`/admin/feedback`** 等仍由静态站点 / `try_files` 交给 React（用户界面）。
- **订阅与认证等后台 JSON**：仍为 **`/admin/auth/*`、`/admin/metrics`、`/admin/subscribers/*`**（见 `admin` 路由）。
- **运营统计与用户反馈 JSON**：已挂在 **`/api/admin/analytics/*`、`/api/admin/feedback/*`**，与页面路径分离；反代将 **`/api/`** 前缀转到 uvicorn 即可（与现有 **`/api/rankings`** 同策略）。

这样不会出现「访问 `/admin/analytics` 时被当成 API」的歧义：页面仍是 `/admin/analytics`，数据接口为 **`/api/admin/analytics/summary`** 等。
