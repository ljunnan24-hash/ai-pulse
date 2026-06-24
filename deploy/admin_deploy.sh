#!/usr/bin/env bash
# 后台“一键部署”脚本模板。
# 建议复制到服务器固定路径，例如 /opt/ai-pulse/deploy/admin_deploy.sh，并配置：
#   ADMIN_DEPLOY_ENABLED=true
#   ADMIN_DEPLOY_SCRIPT_PATH=/opt/ai-pulse/deploy/admin_deploy.sh
#   ADMIN_DEPLOY_WORKDIR=/opt/ai-pulse

set -euo pipefail

ROOT="${APP_ROOT:-/opt/ai-pulse}"
WEB_ROOT="${WEB_ROOT:-/var/www/aipulse}"
API_SERVICE="${API_SERVICE:-aipulse-api}"

cd "$ROOT"

echo "==> git pull"
git rev-parse --is-inside-work-tree >/dev/null
git pull --ff-only

echo "==> backend dependencies"
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  echo "ERROR: backend/.venv not found" >&2
  exit 1
fi
.venv/bin/pip install -r requirements.txt

echo "==> frontend build"
cd "$ROOT"
npm ci
npm run build

echo "==> publish frontend to $WEB_ROOT"
mkdir -p "$WEB_ROOT"
find "$WEB_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a "$ROOT/dist/." "$WEB_ROOT/"

echo "==> restart API: $API_SERVICE"
systemctl restart "$API_SERVICE"

echo "==> reload nginx"
nginx -t
systemctl reload nginx

echo "==> deployed frontend asset"
grep -o 'assets/index-[^"]*\.js' "$ROOT/dist/index.html" || true

echo "OK: deploy finished"
