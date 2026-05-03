#!/usr/bin/env bash
# 在 ECS 上更新代码与 Python 依赖（不执行数据库 DDL；DDL 需单独用 mysql 客户端）。
# 用法：sudo bash deploy/server_update.sh
# 或：   bash deploy/server_update.sh /opt/ai-pulse

set -euo pipefail

ROOT="${1:-/opt/ai-pulse}"
cd "$ROOT"

echo "==> git fetch / pull (ROOT=$ROOT)"
git rev-parse --is-inside-work-tree >/dev/null
git pull --ff-only

echo "==> pip install (venv)"
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  echo "ERROR: 缺少 backend/.venv，请先: cd backend && python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi
.venv/bin/pip install -U pip setuptools wheel
.venv/bin/pip install -r requirements.txt

echo ""
echo "OK: 代码与依赖已更新。"
echo "Next steps:"
echo "  1) MySQL：若尚未执行，请先检查 weekly_issues 是否有重复 period_start，再执行:"
echo "       sql/migrations/2026-05-04_weekly_issues_unique_period.sql"
echo "     （重复行清理 SQL 见该文件顶部注释）"
echo "  2) 若使用 systemd 跑 API:  sudo systemctl restart <你的服务名>"
echo "  3) 可选自测: cd $ROOT/backend && .venv/bin/python -m app.jobs.send_weekly"
echo "     或 TARGET_EMAIL=you@test.com .venv/bin/python -m app.jobs.send_weekly"
