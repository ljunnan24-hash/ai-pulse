# AI Pulse 文档导航

这页是开源读者的文档地图。建议先按“推荐阅读顺序”看，后面的参考文档只在需要理解某个实现细节时再打开。

## 推荐阅读顺序

| 顺序 | 文档 | 适合谁 | 看什么 |
| --- | --- | --- | --- |
| 1 | [`../README.md`](../README.md) | 所有人 | 项目是什么、怎么本地跑起来、需要哪些环境变量。 |
| 2 | [`USAGE_GUIDE.md`](USAGE_GUIDE.md) | 产品使用者、前端读者 | 每个前端页面做什么，用户怎么从首页、榜单、详情、周报、订阅一路使用。 |
| 3 | [`PIPELINE_AND_OBSERVABILITY.md`](PIPELINE_AND_OBSERVABILITY.md) | 想理解项目的人、维护者 | 从抓取信息到处理、评分、日榜、周报 Top3 的完整链路；失败怎么办；怎么观测。 |
| 4 | [`SCORE_AND_RANKING.md`](SCORE_AND_RANKING.md) | 维护者、二次开发者 | Pulse、7d/30d 综合分、`weekly_score` 的准确口径。 |
| 5 | [`部署与数据说明.md`](部署与数据说明.md) | 部署者 | 数据库结构、迁移顺序、生产数据流。 |
| 6 | [`ADMIN_OPERATIONS.md`](ADMIN_OPERATIONS.md) | 维护者、运营者 | 后台信源管理、抓取失败观测、一键部署按钮配置。 |
| 7 | [`command.md`](command.md) | 部署者、维护者 | 常用命令、cron、API smoke check、重算与排障命令。 |

## 按场景阅读

### 我只是想看这个项目能做什么

- 先看 [`../README.md`](../README.md) 顶部中文介绍。
- 再看 [`USAGE_GUIDE.md`](USAGE_GUIDE.md)，里面有每页截图。
- 想知道系统为什么这样排榜，再看 [`PIPELINE_AND_OBSERVABILITY.md`](PIPELINE_AND_OBSERVABILITY.md) 的“日榜、7 日榜、30 日榜由什么决定”和“周榜/周报 Top3 由什么决定”两节。

### 我要自己部署

- [`../README.md`](../README.md) 的 Quick Start、Environment、Deployment Notes。
- [`部署与数据说明.md`](部署与数据说明.md) 的数据库和迁移说明。
- [`ADMIN_OPERATIONS.md`](ADMIN_OPERATIONS.md) 的后台部署按钮配置。
- [`command.md`](command.md) 的运维命令和 smoke checks。
- [`PIPELINE_AND_OBSERVABILITY.md`](PIPELINE_AND_OBSERVABILITY.md) 的“上线后最小巡检清单”。

### 我要改评分或榜单

- [`SCORE_AND_RANKING.md`](SCORE_AND_RANKING.md)：最终榜单分数口径。
- [`SCORING_V1.md`](SCORING_V1.md)：单条 `raw_items.score_total` 的规则分。
- [`去重机制说明.md`](去重机制说明.md)：raw 去重与事件合并边界。
- [`PIPELINE_AND_OBSERVABILITY.md`](PIPELINE_AND_OBSERVABILITY.md)：整条链路和观测方式。

### 我要改周报

- [`PIPELINE_AND_OBSERVABILITY.md`](PIPELINE_AND_OBSERVABILITY.md)：当前生产链路。
- [`SCORE_AND_RANKING.md`](SCORE_AND_RANKING.md)：`weekly_score` 和 Top3 口径。
- [`WEEKLY_TOP3_PROTOCOL.md`](WEEKLY_TOP3_PROTOCOL.md)：Top3 payload 字段协议。

### 我要维护信息源

- [`SOCIAL_SOURCES.md`](SOCIAL_SOURCES.md)：社媒白名单策略。
- [`国内大模型官方信源.md`](国内大模型官方信源.md)：国内模型厂商官方来源候选。
- [`rss源治理记录.md`](rss源治理记录.md)：RSS 健康治理记录。
- [`ADMIN_OPERATIONS.md`](ADMIN_OPERATIONS.md)：后台新增、启停、删除 RSS 源，以及查看抓取失败。
- [`PIPELINE_AND_OBSERVABILITY.md`](PIPELINE_AND_OBSERVABILITY.md)：`feed_crawl_runs` 和 feed health 观测 SQL。

## 参考文档

| 文档 | 用途 |
| --- | --- |
| [`SCORING_V1.md`](SCORING_V1.md) | raw 素材入库前的 6 维规则评分。 |
| [`ADMIN_OPERATIONS.md`](ADMIN_OPERATIONS.md) | 后台信源管理、抓取健康和一键部署按钮配置。 |
| [`SOCIAL_SOURCES.md`](SOCIAL_SOURCES.md) | 社媒信号源白名单和信任等级。 |
| [`WEEKLY_TOP3_PROTOCOL.md`](WEEKLY_TOP3_PROTOCOL.md) | 周报 Top3 结构化字段协议。 |
| [`去重机制说明.md`](去重机制说明.md) | RawItem 与抓取去重说明。 |
| [`国内大模型官方信源.md`](国内大模型官方信源.md) | 国内大模型官方来源候选。 |
| [`rss源治理记录.md`](rss源治理记录.md) | RSS 源治理记录。 |

## 不建议开源读者从这里开始

这些文档已移到 [`internal/`](internal/) 或 [`archive/`](archive/)，默认不作为开源阅读入口：

| 目录 | 内容 | 为什么不放在主线里 |
| --- | --- | --- |
| [`internal/`](internal/) | PRD 原稿、下一步待办、旧发布记录、Agent/API 规划、实现审计长文 | 偏项目过程管理或开发备忘，容易干扰新读者理解当前系统。 |
| [`archive/`](archive/) | 已停用的 legacy 周刊方案 | 只用于理解历史取舍，不是当前生产路径。 |

当前生产口径以 [`PIPELINE_AND_OBSERVABILITY.md`](PIPELINE_AND_OBSERVABILITY.md) 和 [`SCORE_AND_RANKING.md`](SCORE_AND_RANKING.md) 为准。
