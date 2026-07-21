<p align="center">
  <img src="docs/assets/usage/home.png" alt="AI Pulse homepage showing ranked AI industry signals" width="100%" />
</p>

<h1 align="center">AI Pulse</h1>

<p align="center">
  <strong>每天看 AI 信号，每周读 AI 简报。</strong><br />
  <strong>An open-source signal tracker for finding the AI events that actually matter.</strong>
</p>

<p align="center">
  <a href="https://www.aipulse.asia/"><img alt="Live website" src="https://img.shields.io/website?url=https%3A%2F%2Fwww.aipulse.asia%2F&label=live%20website" /></a>
  <a href="https://github.com/ljunnan24-hash/ai-pulse/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ljunnan24-hash/ai-pulse/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" />
</p>

<p align="center">
  <a href="https://www.aipulse.asia/">在线体验</a> ·
  <a href="https://www.aipulse.asia/rankings">AI 排行榜</a> ·
  <a href="https://www.aipulse.asia/weekly/latest">最新周报</a> ·
  <a href="docs/README.md">文档导航</a> ·
  <a href="#quick-start">本地运行</a>
</p>

AI Pulse 从公开 RSS、GitHub 和可配置的信息源收集 AI 动态，将多篇报道聚合为可追溯的事件，再通过去重、评分、标签和 LLM 增强，输出每日榜单、事件详情和中文周报。它既可以作为每天使用的 AI 信息雷达，也可以作为一套完整的内容管线参考实现。

AI Pulse is an open-source AI-industry signal tracker. It collects public sources, merges duplicate coverage into auditable events, scores the resulting signals, and publishes a ranked web experience plus weekly Chinese digests.

## Try it now · 直接体验

- **首页：**[查看今日重点信号](https://www.aipulse.asia/)
- **排行榜：**[按时间、分类和关键词筛选事件](https://www.aipulse.asia/rankings)
- **周报：**[阅读最新一期中文 AI 简报](https://www.aipulse.asia/weekly/latest)
- **订阅：**[通过邮件接收周报](https://www.aipulse.asia/subscribe)

## Why AI Pulse

| 常见问题 | AI Pulse 的处理方式 |
| --- | --- |
| 同一事件被几十篇文章重复报道 | 规范化来源并把相关报道合并为一个事件 |
| 热点很多，但真正重要的信号很少 | 从新鲜度、热度和用户价值等维度进行排序 |
| AI 摘要容易丢失出处 | 保留事件来源、时间和原始链接，支持回溯核验 |
| 每天刷信息成本太高 | 提供每日榜单、事件详情和每周中文简报 |
| 模型供应商容易锁定 | 使用 OpenAI-compatible 接口，可切换不同模型服务 |

## Product tour · 产品预览

| 每日排行榜 | 事件详情 |
| --- | --- |
| [![AI Pulse rankings](docs/assets/usage/rankings.png)](https://www.aipulse.asia/rankings) | ![AI Pulse event detail](docs/assets/usage/event-detail.png) |

| 最新周报 | 历史归档 |
| --- | --- |
| [![AI Pulse weekly report](docs/assets/usage/weekly-latest.png)](https://www.aipulse.asia/weekly/latest) | [![AI Pulse archive](docs/assets/usage/archive.png)](https://www.aipulse.asia/archive) |

## What It Does

- Tracks public AI news from RSS/Atom feeds, optional HTML source pages, GitHub search/trending, and RSS bridges for social sources.
- Normalizes, deduplicates, and scores events into a daily Pulse ranking.
- Generates weekly reports from ranked events with a small LLM pipeline.
- Supports email subscriptions, double opt-in confirmation, unsubscribe/manage links, and optional email tracking.
- Includes an admin console for subscribers, analytics, and feedback.

## Architecture

```text
public sources -> backend crawler/jobs -> SQL database -> FastAPI public/admin APIs
                                                |
                                                v
                                      LLM enrichment + weekly reports
                                                |
                                                v
                                    React SPA + email delivery
```

Key paths:

| Path | Purpose |
| --- | --- |
| `src/` | React frontend, public pages, admin UI, PWA helpers |
| `backend/app/` | FastAPI app, routers, services, jobs |
| `backend/tests/` | Python unit/regression tests |
| `sql/schema.sql` | Full MySQL schema for a fresh database |
| `sql/migrations/` | Incremental SQL migrations for existing databases |
| `deploy/` | Example crontab and Nginx snippets |
| `docs/` | Pipeline, scoring, source, and operations notes |
| `docs/README.md` | Documentation map and recommended reading order |
| `docs/USAGE_GUIDE.md` | Chinese frontend usage guide with page screenshots |
| `docs/PIPELINE_AND_OBSERVABILITY.md` | Chinese end-to-end pipeline, ranking, failure, and observability guide |

## Requirements

- Node.js 20+
- Python 3.10+
- MySQL 8+ for production
- Optional for local smoke testing: SQLite via `DATABASE_URL=sqlite:///./dev.db`

<a id="quick-start"></a>

## Quick Start

Clone and install frontend dependencies:

```bash
npm install
cp .env.example .env
npm run dev
```

Start the backend in another terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip setuptools wheel
pip install -r requirements.txt
cp .env.example .env
```

For a quick local API boot without MySQL, set this in `backend/.env`:

```bash
DATABASE_URL=sqlite:///./dev.db
PUBLIC_APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
WEEKLY_PUBLIC_BASE_URL=http://localhost:3000
MAIL_DRY_RUN=true
ADMIN_JWT_SECRET=dev_secret_change_me
```

Then run:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open:

- Frontend: `http://localhost:3000`
- API health: `http://127.0.0.1:8000/health`
- Admin login page: `http://localhost:3000/admin/login`

Vite proxies `/api`, `/manage`, and `/health` to the local backend when `VITE_API_BASE_URL` is empty.

For the documentation map and recommended reading order, see `docs/README.md`.
For a page-by-page walkthrough of the frontend, see `docs/USAGE_GUIDE.md`.
For the full ingestion → processing → ranking → weekly report chain, see `docs/PIPELINE_AND_OBSERVABILITY.md`.

## Environment

Frontend variables live in `.env`:

```bash
VITE_API_BASE_URL=
VITE_CONTACT_EMAIL=2089128910@qq.com
VITE_SITE_URL=https://www.aipulse.asia
VITE_WECHAT_GROUP_QR_SRC=/assets/wechat-group-qr.png
VITE_REWARD_QR_SRC=/assets/reward-qr.png
```

The About page also uses these same values as production fallbacks. Put the actual QR images at
`public/assets/wechat-group-qr.png` and `public/assets/reward-qr.png`, or point the variables above to hosted image URLs.

Backend variables live in `backend/.env`. Important groups:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLAlchemy database URL |
| `PUBLIC_APP_URL` / `FRONTEND_URL` | Links used in confirmation, unsubscribe, and manage flows |
| `WEEKLY_PUBLIC_BASE_URL` | Public weekly report base URL |
| `LLM_API_KEY` / `LLM_API_BASE` / `LLM_MODEL` | OpenAI-compatible LLM provider |
| `SMTP_*` / `MAIL_FROM` | Email delivery |
| `*_RSS_URLS` / `OFFICIAL_PAGE_URLS` | Content source configuration |
| `GITHUB_TOKEN` | Optional, raises GitHub API rate limits |
| `ADMIN_JWT_SECRET` | Required for admin auth |

DeepSeek example:

```bash
LLM_API_KEY=...
LLM_API_BASE=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
LLM_MAX_TOKENS=16384
```

OpenAI-compatible default:

```bash
LLM_API_BASE=https://api.openai.com/v1
```

Volcengine Ark compatibility is still available through either the generic `LLM_API_*` variables or the legacy `DOUBAO_*` variables. When `LLM_API_KEY` and `LLM_MODEL` are set, they take priority.

## Database

For a fresh MySQL database:

```bash
mysql -h HOST -u USER -p DATABASE_NAME < sql/schema.sql
```

For an existing deployment, apply the files in `sql/migrations/` as needed. See `docs/部署与数据说明.md` for migration notes.

The FastAPI app calls `Base.metadata.create_all(...)` on startup, which is convenient for local SQLite smoke tests. Production MySQL deployments should still use `sql/schema.sql` or migrations so indexes and schema details stay explicit.

## Common Commands

Frontend:

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

Backend:

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. python -m pytest
python -m app.jobs.daily_rankings
python -m app.jobs.enrich_rankings --limit 10
python -m app.jobs.generate_weekly --force
python -m app.jobs.send_weekly --test
```

Create a local admin user:

```bash
cd backend
ADMIN_USERNAME=admin ADMIN_PASSWORD=change_me python scripts/create_admin_user.py
```

## Deployment Notes

A typical production deployment uses:

- Nginx serving `dist/` and reverse proxying API routes to Uvicorn.
- Nginx reverse proxying `/sitemap.xml` to Uvicorn so the dynamic sitemap includes current weekly reports and event pages.
- Uvicorn bound to `127.0.0.1:8000` behind systemd.
- MySQL/RDS for persistent data.
- Cron for daily rankings and weekly generation/sending.

Example cron schedules are in `deploy/crontab.example`. Example Nginx rate-limit snippets are in `deploy/`.

Minimal deployment flow:

```bash
git pull --ff-only

cd backend
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart aipulse-api

cd ..
npm ci
npm run build
sudo rsync -a --delete dist/ /var/www/aipulse/
sudo nginx -t && sudo systemctl reload nginx
```

## Security Before Publishing

- Do not commit `.env`, API keys, SMTP credentials, database URLs, TLS files, or private QR codes.
- Replace `ADMIN_JWT_SECRET` with a strong random value in production.
- Keep `MAIL_DRY_RUN=true` until email credentials and DNS/domain verification are ready.
- Review `docs/README.md` and `docs/command.md` before publishing any personal operations notes.
- Report suspected vulnerabilities according to [SECURITY.md](SECURITY.md); do not disclose secrets in public issues.

## Tests And Quality

Current checks:

```bash
npm run lint
npm test
cd backend && PYTHONPATH=. .venv/bin/python -m pytest
```

The repository has focused regression tests for ranking windows, score logic, URL dedupe, weekly payload shaping, and configuration loading.

## Contributing

Bug reports, source-quality improvements, scoring discussions, documentation fixes, and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Released under the [MIT License](LICENSE).
