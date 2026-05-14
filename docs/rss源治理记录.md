# RSS 源治理记录

本文档记录基于 `feed_crawl_runs`（`daily_rankings`）观测到的**稳定坏源**与**波动坏源**结论，以及配置调整建议。**不自动修改生产 `backend/.env`**；生产变更请手動合并下列建议片段。

---

## 判定口径（摘要）

| 类型 | 条件 |
|------|------|
| 可用 | `health_status` 为 `ok` 或 `no_new_items`（后者表示抓取成功但与其它源去重/Top80 截断后未入库，**不是坏源**）。 |
| 稳定坏源（建议移出） | 最近 **≥3 条**记录且**最近连续 3 次**均为 `invalid_feed`，或均为 `fetch_failed` 且 `http_status=404`。 |
| 波动 / 观察 | 记录不足 3 条、`403`、错误信息含 timeout/DNS/connection reset、或 7 天内**既有成功也有失败**（flaky）。 |
| NVIDIA 替换 | 旧链 `nvidianews.../rss`（HTML）、`blogs.nvidia.com/blog/feed/`（404）可替换为 **Newsroom XML** 或 **FeedBurner 博客代理**（见下节验证）。 |

自动化脚本：`backend/scripts/rss_source_governance.py`（读库 + 分类 + `reports/rss_source_governance.json`）。  
SQL 汇总示例见 `docs/command.md` →「RSS 按 feed_url 汇总（最近 7 天）」。

---

## NVIDIA 候选 RSS 验证（2026-05）

使用 `cd backend && python scripts/verify_feeds_stdlib.py --nvidia-defaults`（口径：**HTTP 2xx + 正文含 `<rss`/`<feed` + `<item`/`<entry` 计数 >0**）：

| URL | 结果 |
|-----|------|
| `https://nvidianews.nvidia.com/releases.xml` | 通过（全量新闻稿，条目多） |
| `https://nvidianews.nvidia.com/cats/generative_al.xml` | 通过（「Generative Al」分类，条目可能较少） |
| `https://feeds.feedburner.com/nvidiablog` | 通过（博客；`atom:link` 指向的 `blogs.nvidia.com/feed/` 曾 404，FeedBurner 仍可用） |

**建议：** 生产 `OFFICIAL_RSS_URLS` 中至少加入 **`releases.xml` 或 `generative_al.xml` 其一**（全量 vs 垂类二选一或并列）+ **`feeds.feedburner.com/nvidiablog`** 替代已死 `blogs.nvidia.com/blog/feed/`。

---

## 本批「稳定坏源」与原因（勿再盲目留在 OFFICIAL_RSS_URLS）

以下源在多次 `daily_rankings` 中表现为 **`invalid_feed`（200+HTML 非 RSS）** 或 **`fetch_failed`+404/403**，且无同等稳定的官方 XML 直链可替换（除 NVIDIA 已上表外）。

| URL | 典型原因 | 处理 |
|-----|----------|------|
| `https://www.jiqizhixin.com/rss` | `302` → 非 RSS 页（反爬/商业承接），爬虫已用标准 Chrome UA 仍非 XML。 | **从 `MEDIA_RSS_URLS` 移除**；若需内容请 RSSHub 自建或换其它媒体源。 |
| `https://alignment.anthropic.com/feed.xml` | 静态站，`feed.xml` 实为 HTML。 | **移出** |
| `https://blog.langchain.com/rss/` | 301 到新域；`https://www.langchain.com/blog/rss` 实测 **200+HTML**（前端壳），非稳定 RSS。 | **移出** |
| `https://nvidianews.nvidia.com/rss` | 返回 HTML 列表页，非 XML Feed。 | **替换**为 `releases.xml` 等 |
| `https://blogs.nvidia.com/blog/feed/` | **404** | **替换**为 FeedBurner |
| `https://stability.ai/news?format=rss` | 301 到 Squarespace 营销页 HTML。 | **移出** |
| `https://txt.cohere.ai/rss/` | 301/308 到 `cohere.com` 博客，未落到稳定 RSS XML。 | **移出** |
| `https://mistral.ai/news/feed.xml` | **404** | **移出** |
| `https://www.anthropic.com/news/rss.xml` | **404**（站点改版，无该原生路径） | **移出**；若需新闻可考虑 OpenRSS/RSSHub（非本轮范围） |
| `https://www.anthropic.com/research/rss.xml` | **404** | **移出** |
| `https://www.databricks.com/blog/rss.xml` | **404**（Vercel） | **移出** |
| `https://www.llamaindex.ai/blog/rss.xml` | **404**（Vercel） | **移出** |
| `https://www.perplexity.ai/hub/blog/rss.xml` | **403**（防爬） | **列入 watch**；未稳定前**移出**官方列表 |

---

## 不应删除（仅 no_new_items）

| URL | 说明 |
|-----|------|
| `https://openai.com/news/rss.xml` | 常为 `no_new_items`：与 `openai.com/blog/rss.xml` 等**去重后未进 Top80**，抓取仍成功。**保留**。 |

---

## Flaky（需继续观察）

凡 7 天内 **`ok` 与失败状态交替**（脚本 JSON 中 `flaky: true`），**不删除**；若连续转为稳定坏源再按上表处理。典型：`403` 后 `feedparser.parse(url)` 偶发成功的媒体源。

---

## 生产 `.env` 手動维护：建议片段

### 1）建议从逗号分隔列表中**删除**的 URL（整段删除子串即可）

```
https://www.jiqizhixin.com/rss
https://alignment.anthropic.com/feed.xml
https://blog.langchain.com/rss/
https://nvidianews.nvidia.com/rss
https://blogs.nvidia.com/blog/feed/
https://stability.ai/news?format=rss
https://txt.cohere.ai/rss/
https://mistral.ai/news/feed.xml
https://www.anthropic.com/news/rss.xml
https://www.anthropic.com/research/rss.xml
https://www.databricks.com/blog/rss.xml
https://www.llamaindex.ai/blog/rss.xml
https://www.perplexity.ai/hub/blog/rss.xml
```

### 2）建议**追加**到 `OFFICIAL_RSS_URLS`（已按 verify 脚本验证）

```
https://nvidianews.nvidia.com/releases.xml
https://nvidianews.nvidia.com/cats/generative_al.xml
https://feeds.feedburner.com/nvidiablog
```

（若与现有列表重复请去重；`releases.xml` 与 `generative_al.xml` 可按流量需求只保留其一。）

---

## 本轮明确不做

- `OFFICIAL_WATCH_PAGE_URLS` / page_watch / Playwright / 国内官网扩源 / X 接入 — 均不在本轮范围。

---

## 变更索引

| 日期 | 说明 |
|------|------|
| 2026-05-14 | 首版：基于 `feed_crawl_runs` + curl/verify_feeds_stdlib 的 NVIDIA 候选验证与坏源清单。 |
