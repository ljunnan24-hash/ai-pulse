# 后台运维功能

本文说明后台管理里的两个运维入口：**信源管理**和**部署**。

## 信源管理

后台路径：`/admin/sources`

### RSS 源怎么生效

系统有两种 RSS 配置来源：

1. `rss_sources` 数据库表有记录时：爬虫只使用表里 `is_enabled=1` 的 RSS 源。
2. `rss_sources` 为空时：爬虫回退到 `.env` 的 `OFFICIAL_RSS_URLS` / `MEDIA_RSS_URLS` / `PRODUCT_RSS_URLS` 等配置。

这样可以保证新功能上线后不会影响旧部署。第一次使用后台管理时，可以在页面上把当前 `.env` RSS 源导入数据库，然后再启停、删除或新增 RSS 源。

### RSS 分类

后台里的频道会转换成抓取和评分使用的来源优先级：

| 频道 | tier | 用途 |
| --- | ---: | --- |
| `official` | 0 | 官方博客、公告、研究页 RSS |
| `meta` | 0 | Meta AI 等特殊官方源 |
| `media` | 1 | 行业媒体 |
| `product` | 2 | 产品发布、上新类源 |
| `community` | 3 | 社区源 |
| `x` | 4 | X/RSSHub/Nitter 等社媒桥接源 |

### 抓取失败怎么看

后台路径：`/admin/sources` 的“抓取健康”面板。

数据来自 `feed_crawl_runs` 表，展示最近 14 天每个源的：

- 最近一次 `health_status`
- HTTP 状态码
- 本次解析出的条目数
- 最近窗口内失败次数
- 连续失败次数
- 最近一次错误类型和错误信息

状态口径：

| 状态 | 含义 |
| --- | --- |
| `ok` / `no_new_items` | 抓取正常；后者表示没有新内容入库 |
| `empty_feed` / `all_filtered` | 抓到了源，但没有可用条目，需要观察 |
| `fetch_failed` / `invalid_feed` / `parse_failed` | 抓取、内容格式或解析失败，需要处理 |
| `no_data` | 后台启用了该源，但最近窗口内还没有抓取记录 |

## 部署按钮

后台路径：`/admin/deploy`

部署按钮默认关闭。它不会接收页面输入的命令，只会执行服务器 `.env` 里配置的固定脚本。

### 环境变量

```env
ADMIN_DEPLOY_ENABLED=true
ADMIN_DEPLOY_SCRIPT_PATH=/opt/ai-pulse/deploy/admin_deploy.sh
ADMIN_DEPLOY_WORKDIR=/opt/ai-pulse
ADMIN_DEPLOY_TIMEOUT_SECONDS=180
```

脚本模板见：

```bash
deploy/admin_deploy.sh
```

脚本需要有可执行权限：

```bash
chmod +x /opt/ai-pulse/deploy/admin_deploy.sh
```

### 权限注意

`admin_deploy.sh` 会执行：

- `git pull --ff-only`
- 后端依赖安装
- `npm ci && npm run build`
- 发布 `dist/` 到 `/var/www/aipulse`
- `systemctl restart aipulse-api`
- `nginx -t && systemctl reload nginx`

如果 API 进程不是 root 用户，需要给运行 API 的用户配置受限 sudo 权限，或把部署脚本改成只做该用户有权限的步骤。

### 推荐验证

后台点击部署后，页面会显示 `stdout` / `stderr` 和 exit code。部署完成后也可以手动查：

```bash
curl -s https://www.aipulse.asia/ | grep -o 'assets/index-[^"]*\.js'
curl -s https://www.aipulse.asia/api/health
```
