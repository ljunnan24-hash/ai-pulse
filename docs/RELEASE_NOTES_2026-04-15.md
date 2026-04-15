## 目的
记录本次“管理后台可上线化”相关改动、验收步骤与上线检查清单，避免遗忘。

## 关键结论
- **Admin bootstrap HTTP 入口已移除**：`POST /admin/auth/bootstrap` 返回 404。
- **管理员初始化改为本地脚本**：通过 `backend/scripts/create_admin_user.py` 创建首个管理员，不暴露公网初始化接口。
- **导出 CSV 已支持鉴权**：前端用 `fetch` 携带 `Bearer` 下载，不再出现 `Missing bearer token`。
- **导出路由冲突已修复**：避免 `/admin/subscribers/export.csv` 被误匹配为 `subscriber_id`。

## 涉及的主要文件
- **后端**
  - `backend/app/routers/admin.py`：移除 bootstrap；订阅者详情与操作改为 `/subscribers/by-id/{id}`；CSV 导出保留 `/subscribers/export.csv`
  - `backend/app/config.py`：移除 `admin_bootstrap_token`
  - `backend/.env.example`：移除 `ADMIN_BOOTSTRAP_TOKEN`
  - `backend/scripts/create_admin_user.py`：新增（初始化管理员）
  - `backend/scripts/dev_seed_sqlite.py`：新增（本地 sqlite 注入订阅者，用于自测）
- **前端**
  - `src/admin/pages/AdminSubscribersPage.tsx`：导出 CSV 改为带 token 的下载
  - `src/admin/api/client.ts`：订阅者详情/操作路径改为 `/admin/subscribers/by-id/{id}`

## 本地验收（建议）
### 前置
- Node / npm 正常（本仓库已用 Vite 构建验证）
- 建议使用 conda 环境 `aipulse`（Python 3.11）

### 1) 启动后端（sqlite）
```bat
cd backend
set DATABASE_URL=sqlite:///./dev.db
set ADMIN_JWT_SECRET=dev_secret_change_me
conda run --no-capture-output -n aipulse python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
```

健康检查：
```text
GET http://127.0.0.1:8000/health
```

### 2) 创建管理员（本地脚本）
```bat
cd backend
set DATABASE_URL=sqlite:///./dev.db
set ADMIN_USERNAME=admin
set ADMIN_PASSWORD=Admin12345678
conda run --no-capture-output -n aipulse python scripts\create_admin_user.py
```

### 3) （可选）注入一条订阅者方便看列表
```bat
cd backend
set DATABASE_URL=sqlite:///./dev.db
conda run --no-capture-output -n aipulse python scripts\dev_seed_sqlite.py
```

### 4) 启动前端
```bash
npm run dev
```

访问：
```text
http://localhost:3000/admin/login
```

验收点：
- 登录成功后可进 Dashboard/Subscribers
- Subscribers 列表/详情可打开
- 点击“导出 CSV”会直接下载文件（不再打开 JSON 错误页）

## 上线检查清单（生产）
### 必配环境变量（后端）
- `DATABASE_URL`（RDS MySQL）
- `PUBLIC_APP_URL`（用于邮件链接）
- `FRONTEND_URL`
- `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`/`MAIL_FROM`
- `DOUBAO_API_KEY`/`DOUBAO_MODEL`（如需生成周报）
- **Admin**
  - `ADMIN_JWT_SECRET`：强随机
  - `ADMIN_JWT_EXPIRES_HOURS`：默认 24
  - `ADMIN_FRONTEND_URL`：限制 CORS（如 `https://admin.aipulse.asia`）

### 安全与运维
- 生产环境**不要存在任何 bootstrap 初始化 HTTP 入口**（已移除）。
- 首个管理员通过服务器本地执行脚本创建（或在受控环境执行一次）。
- **密钥轮换**：如果 `backend/.env` 曾以截图/粘贴等方式外泄，立即轮换 DB/SMTP/API key。
- 确认服务器时区 `Asia/Shanghai`（影响周报周期与 cron）。
- Nginx/反代、systemd、cron 参照 `README.md` 的 ECS runbook。

