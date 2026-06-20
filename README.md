# AI Pulse

AI Pulse 是一个面向 AI 行业信息整理的开源项目。它会从公开 RSS、GitHub 和可配置的信息源中收集 AI 动态，把多篇报道合并成清晰的事件，再通过评分、标签和 LLM 生成摘要，输出每日榜单、事件详情和中文周报。这个项目适合用来搭建自己的 AI 信息雷达，也适合学习一个从采集、去重、评分、LLM 增强到前端展示和邮件分发的完整内容系统。

AI Pulse is an AI-industry signal tracker. It collects public RSS/GitHub sources, deduplicates related stories into events, scores them, and publishes a ranked web experience plus weekly Chinese digests.

The project contains a Vite + React frontend and a Python FastAPI backend. LLM calls use an OpenAI-compatible Chat Completions API, so providers such as DeepSeek, OpenAI-compatible gateways, or Volcengine Ark can be swapped by environment variables.

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
| `docs/USAGE_GUIDE.md` | Chinese frontend usage guide with page screenshots |

## Requirements

- Node.js 20+
- Python 3.10+
- MySQL 8+ for production
- Optional for local smoke testing: SQLite via `DATABASE_URL=sqlite:///./dev.db`

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

For a page-by-page walkthrough of the frontend, see `docs/USAGE_GUIDE.md`.

## Environment

Frontend variables live in `.env`:

```bash
VITE_API_BASE_URL=
VITE_CONTACT_EMAIL=contact@example.com
# Optional public image URLs for your own deployment.
# VITE_WECHAT_GROUP_QR_SRC=/assets/wechat-group-qr.example.png
# VITE_REWARD_QR_SRC=/assets/reward-qr.example.png
```

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
- Review `docs/command.md` before publishing any personal operations notes.
- Add a `LICENSE` file before announcing the repository as open source.

## Tests And Quality

Current checks:

```bash
npm run lint
npm test
cd backend && PYTHONPATH=. .venv/bin/python -m pytest
```

The repository has focused regression tests for ranking windows, score logic, URL dedupe, weekly payload shaping, and configuration loading.
