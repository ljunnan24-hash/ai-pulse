#!/usr/bin/env bash
# 在 ECS 上安装 Nginx 限流片段（避免 nano 粘贴多行错乱）
# 用法：cd /opt/ai-pulse && sudo bash deploy/install-nginx-rate-limit.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNIPPET_SRC="$REPO_ROOT/deploy/snippets/aipulse-rate-locations.conf"
SNIPPET_DST="/etc/nginx/snippets/aipulse-rate-locations.conf"
NGINX_CONF="/etc/nginx/nginx.conf"
SITE_CONF="/etc/nginx/conf.d/aipulse.conf"

if [[ ! -f "$SNIPPET_SRC" ]]; then
  echo "找不到 $SNIPPET_SRC，请在仓库根目录执行。" >&2
  exit 1
fi

echo "==> 安装 location 片段到 $SNIPPET_DST"
mkdir -p /etc/nginx/snippets
cp "$SNIPPET_SRC" "$SNIPPET_DST"
chmod 644 "$SNIPPET_DST"

if ! grep -q 'zone=aipulse_api_read' "$NGINX_CONF" 2>/dev/null; then
  echo ""
  echo "【需手动一次】编辑 $NGINX_CONF"
  echo "在 http { } 内、include /etc/nginx/conf.d 之前加入："
  echo ""
  echo '    limit_req_zone $binary_remote_addr zone=aipulse_api_read:10m rate=40r/s;'
  echo '    limit_req_zone $binary_remote_addr zone=aipulse_api_write:10m rate=2r/s;'
  echo ""
else
  echo "==> nginx.conf 中已有 limit_req_zone，跳过提示"
fi

if [[ -f "$SITE_CONF" ]]; then
  if grep -q 'aipulse-rate-locations.conf' "$SITE_CONF"; then
    echo "==> $SITE_CONF 已包含 include 片段，跳过"
  else
    echo ""
    echo "【需手动两行】编辑 $SITE_CONF 的 443 server { }："
    echo ""
    echo "1) 在 root 附近加（若无）："
    echo "       limit_req_status 429;"
    echo ""
    echo "2) 在 location /api/ { 的上一行加："
    echo "       include /etc/nginx/snippets/aipulse-rate-locations.conf;"
    echo ""
    echo "3) 在 location /api/ { 内第一行加："
    echo "       limit_req zone=aipulse_api_read burst=80 nodelay;"
    echo ""
  fi
else
  echo "未找到 $SITE_CONF，请自行在站点 server 内 include $SNIPPET_DST"
fi

echo ""
echo "完成后执行："
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo "  cd /opt/ai-pulse/backend && sudo systemctl restart aipulse-api"
