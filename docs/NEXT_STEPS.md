# 下一步你需要做的事情（Owner: 你）

本清单只列“必须由你在环境/账号/服务器侧完成”的事项（我无法代替你操作的部分）。

## 1) 数据库与迁移（生产必做）

- 在生产 MySQL（RDS）上执行迁移脚本（按时间顺序）：
  - `sql/migrations/2026-04-24_add_scoring_and_sources.sql`
  - `sql/migrations/2026-05-02_issue_events.sql`（事件聚合表 + `raw_items.event_id`）
  - `sql/migrations/2026-05-03_raw_items_extra_json.sql`（爬虫元数据 `extra_json`，与 PRD RawItem 对齐）
- 确认 `raw_items` 表已包含（用于评分与多源）：
  - `source_type`
  - `score_total`
  - `score_breakdown_json`
  - `extra_json`（新迁移）
- 合并与选题依赖 `issue_events`：详见 `docs/部署与数据说明.md`

## 2) 环境变量（后端）

在服务器 `backend/.env`（或系统环境变量）配置：

- **基础**
  - `DATABASE_URL`
  - `PUBLIC_APP_URL`
  - `FRONTEND_URL`
  - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `MAIL_FROM`
  - `DOUBAO_API_KEY` / `DOUBAO_MODEL`（用于生成周报文稿）
- **RSS 源（建议先用 RSS 跑通）**
  - `OFFICIAL_RSS_URLS=...`（公司官网/博客 RSS）
  - `MEDIA_RSS_URLS=...`（行业媒体 RSS）
  - `X_RSS_URLS=...`（X/Twitter 的 RSS 桥接链接，若使用）
  - `META_RSS_URLS=...`（可选，用于 Meta AI Blog 的 RSS 桥接链接）
- **GitHub**
  - `GITHUB_TOKEN`（强烈建议：避免 API 限流导致抓取失败）
  - `GITHUB_TRENDING_SINCE_DAYS` / `GITHUB_TRENDING_MIN_STARS_GROWTH` / `GITHUB_TRENDING_LANGUAGE`

## 3) 社媒账号白名单（运营/策略）

- 根据 `docs/SOCIAL_SOURCES.md` 补齐你认可的账号清单（官方/CEO/研究员/KOL）
- 明确每个账号的 `account_trust_level`（3/2/1）

> 说明：若暂时不做社媒抓取，可先只维护“官方/CEO”这层白名单用于未来扩展。

## 4) 服务器运维

- 确认服务器时区：`Asia/Shanghai`
- 确认 cron（每周生成/发送）：
  - 生成：周一 00:30
  - 发送：周一 09:00
- 确认证书/私钥不在代码仓库中（已通过 `.gitignore` 降风险，但仍要运维侧约束）

## 5) 信息源与抓取路线图（v1，开发任务）

完整清单与表格见根目录 **`prd.md` 第五节（数据来源策略与信息源爬虫清单 v1）**。

**第一阶段（与当前代码对齐：RSS + GitHub）**

- 将 PRD「5.7 推荐第一版 12 源」中能直接用 RSS 的 URL 填入 `OFFICIAL_RSS_URLS`、`MEDIA_RSS_URLS`、`META_RSS_URLS`（需逐个验证可解析的 feed 地址；部分站点仅有列表页、需 RSSHub 或后续页面抓取任务）。
- 保持 `GITHUB_TOKEN` 与 `GITHUB_TRENDING_*` 配置，落实 PRD「5.4」筛选规则可在 `github_service` / 流水线侧迭代。
- `RawItem` 逻辑字段向 PRD「5.8」收敛（与现有 `raw_items` 列映射）。

**第二阶段**

- 接入 Product Hunt GraphQL、HN API、Reddit `.rss`（或统一走 RSS 聚合层），`source_type` 使用 `community`。

**第三阶段**

- X 仅白名单：`X_RSS_URLS`（RSS 桥接）或独立采集通道；与 `docs/SOCIAL_SOURCES.md` / `docs/social_sources.v1.json` 一致。

## 6) 验收（你需要跑一遍）

- 本地或服务器上跑一次：
  - `python -m app.jobs.generate_weekly`
  - `python -m app.jobs.send_weekly`（可用 `DRY_RUN=1` 或 `TARGET_EMAIL=...`）
- 验证：
  - raw_items 是否有 score_total 写入
  - 邮件内容是否为 TopN（含关键词优先逻辑）

