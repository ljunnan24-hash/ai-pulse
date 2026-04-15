# AI Pulse

English marketing SPA (Vite + React) plus a **Python (FastAPI)** backend: RSS ingestion, Volcengine Ark (豆包) weekly summaries in **Chinese**, double opt-in email via **Aliyun DirectMail**, and MySQL (RDS) storage.

## Repo layout

| Path | Role |
|------|------|
| `src/` | Frontend: subscription UI, demo Simple/Normal views |
| `backend/` | API + cron jobs (`generate_weekly`, `send_weekly`) |
| `sql/schema.sql` | MySQL DDL |
| `deploy/crontab.example` | Beijing-time cron samples |

## Local development

### 1) Database

Create schema (local MySQL or RDS):

```bash
mysql -h HOST -u USER -p < sql/schema.sql
```

### 2) Backend

**Requires Python 3.10+** (FastAPI 0.115.x). Some ECS images default to `python3` 3.6 — use `python3.11 -m venv .venv` (or install `python3.11` / `python3.9` from your OS packages) before `pip install`.

```bash
cd backend
cp .env.example .env
# Edit .env: DATABASE_URL, PUBLIC_APP_URL, FRONTEND_URL, DOUBAO_*, SMTP_*, MAIL_FROM

python3 -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -U pip setuptools wheel
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Manual jobs (Beijing week logic uses **server timezone** — set to `Asia/Shanghai` on ECS):

```bash
cd backend
python -m app.jobs.generate_weekly
python -m app.jobs.send_weekly
```

### 3) Frontend

```bash
npm install
npm run dev
```

Vite proxies `/api`, `/manage`, and `/health` to `http://127.0.0.1:8000`. Leave `VITE_API_BASE_URL` empty in dev.

For production builds that talk to another origin, set `VITE_API_BASE_URL=https://api.yourdomain.com` before `npm run build`.

## Admin console (后台管理系统)

后台前端通过路由前缀 **`/admin/*`** 与官网完全隔离，确保不影响官网原功能。

### Admin 本地开发（Windows + conda）

如果本机无法访问 `https` 的 conda/pip 源，可用 `http` 镜像（本仓库在 Win11/conda 环境下已验证可用）。

#### 1) 创建 conda 环境（使用 http 镜像）

```bat
conda create -n aipulse python=3.11 -y --override-channels ^
  -c http://mirrors.ustc.edu.cn/anaconda/pkgs/main ^
  -c http://mirrors.ustc.edu.cn/anaconda/cloud/conda-forge
```

#### 2) 安装后端依赖（pip 走 http 源）

```bat
conda run -n aipulse pip install -r backend/requirements.txt ^
  -i http://pypi.tuna.tsinghua.edu.cn/simple ^
  --trusted-host pypi.tuna.tsinghua.edu.cn
```

#### 3) 启动后端（本地建议用 sqlite，避免连接 RDS 超时）

```bat
cd backend
set DATABASE_URL=sqlite:///./dev.db
set ADMIN_JWT_SECRET=dev_secret_change_me
conda run --no-capture-output -n aipulse python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
```

验证健康检查：

```text
GET http://127.0.0.1:8000/health
```

#### 4) 初始化第一个管理员（本地脚本）

通过脚本创建管理员（不会暴露 HTTP 初始化入口）：

```bat
cd backend
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=Admin12345678
conda run --no-capture-output -n aipulse python scripts\create_admin_user.py
```

#### 5) 启动前端（已代理 /admin 到 8000）

```bash
npm run dev
```

访问后台：

```text
http://localhost:3000/admin/login
```

### Admin 生产环境配置（必填）

在 `backend/.env`（或环境变量）里配置：

- `ADMIN_JWT_SECRET`：JWT 签名密钥（强随机）
- `ADMIN_JWT_EXPIRES_HOURS`：默认 24
- `ADMIN_FRONTEND_URL`：例如 `https://admin.aipulse.asia`（用于 CORS）

## Product rules (implemented)

- **Subscribe**: `POST /api/subscribe` → confirmation email (Chinese).  
- **Confirm**: `GET /api/confirm?token=…` → if latest `ready` issue exists, send it (keyword filter + mode); else welcome email.  
- **Weekly**: Monday **00:30** generate issue; Monday **09:00** send to all active subscribers (idempotent per issue).  
- **Manage**: `GET /POST /manage/{manage_token}` (minimal HTML).  
- **Unsubscribe**: `GET /api/unsubscribe?token=…`.

## Aliyun deployment (summary)

- **ECS** (~2 vCPU / 2 GiB): Nginx + TLS (Aliyun certificate), reverse-proxy to Uvicorn, timezone `Asia/Shanghai`.  
- **RDS MySQL**: run `sql/schema.sql`.  
- **DirectMail**: verify domain, fill `SMTP_*` and `MAIL_FROM`.  
- **Cron**: see `deploy/crontab.example`.  
- **Secrets**: `backend/.env` (never commit).

## Server runbook (ECS)

Assumptions (current setup):

- Project: `/opt/ai-pulse`
- Frontend Nginx root: `/var/www/aipulse`
- Nginx site config: `/etc/nginx/conf.d/aipulse.conf`
- Backend: systemd service `aipulse-api` (Uvicorn on `127.0.0.1:8000`)

### 1) Update code

```bash
cd /opt/ai-pulse
git pull
git log -1 --oneline
```

### 2) Backend (API) restart + logs

```bash
sudo systemctl restart aipulse-api
sudo systemctl status aipulse-api --no-pager
sudo journalctl -u aipulse-api -n 200 --no-pager
```

Follow logs in real time:

```bash
sudo journalctl -u aipulse-api -f
```

### 3) Frontend rebuild + deploy

This repo currently does not require a lockfile on the server, so use `npm install` (not `npm ci`).

```bash
cd /opt/ai-pulse
npm install
npm run build

sudo rm -rf /var/www/aipulse/*
sudo cp -r dist/* /var/www/aipulse/

sudo nginx -t && sudo systemctl reload nginx
```

### 4) Nginx config view + reload

```bash
sudo sed -n '1,260p' /etc/nginx/conf.d/aipulse.conf
sudo nginx -t && sudo systemctl reload nginx
```

### 5) MySQL (RDS) login

```bash
mysql -h rm-j6cv7e2mg6bw443p1.mysql.rds.aliyuncs.com -P 3306 -u aipulse -p
```

Then:

```sql
USE aipulse;
```

Check latest issues:

```sql
SELECT id, period_start, status, ready_at
FROM weekly_issues
ORDER BY ready_at DESC, created_at DESC
LIMIT 5;
```

### 6) Cron jobs (weekly)

See `deploy/crontab.example`.

List root crontab:

```bash
sudo crontab -l
```

Job logs (if using the example):

```bash
sudo tail -n 200 /var/log/aipulse-generate.log
sudo tail -n 200 /var/log/aipulse-send.log
```

## Volcengine Ark (豆包)

Create an API key and an **endpoint model ID** (`ep-…`). Set `DOUBAO_API_KEY`, `DOUBAO_MODEL`, and optionally `DOUBAO_API_BASE` in `backend/.env`.
