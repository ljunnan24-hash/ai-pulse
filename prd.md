AI Pulse PRD v3（最终结构化版 · 可开发）
（基于你的原文重构整理 ）

一、产品概述
1.1 背景
非技术用户难以高效获取 AI 行业信息：
信息噪音大 
技术门槛高 
时间成本高 

1.2 产品定义
AI Pulse =
AI行业信息筛选 + 用户价值解释 + 行动判断建议
不是资讯产品，而是：
👉 面向非技术用户的 AI 决策辅助系统

1.3 核心价值
用户不是为了“知道发生了什么”，而是：
是否需要关注？ 
是否值得尝试？ 
是否会影响我的工作/业务？ 

1.4 核心输出
输入：多源AI信息（官网 / 媒体 / GitHub / 社区）
处理：事件抽取 → 去重 → 事实校验 → 价值解释
输出：
- Simple周报（快速了解）
- Normal周报（决策参考）
- AI能力判断（核心差异）

1.5 核心指标（MVP）
订阅转化率（访客→订阅→确认） 
周报打开率 / 点击率 
退订率（<2%） 
内容质量（错误率 / 重复率） 

二、用户与场景
2.1 目标用户
非技术职场人 
创业者（OPC） 
管理者 / 学生 

2.2 非目标用户
AI开发者（论文 / 代码导向） 

2.3 核心场景
场景1：30秒了解AI本周发生了什么
场景2：判断某个AI能力是否值得使用
场景3：发现AI工具与商业机会

三、核心体验流程
访问官网 → 选择模式 → 输入邮箱 + 关键词 → 订阅
↓
邮件确认（double opt-in）
↓
每周自动收到周报
↓
可退订 / 修改关键词 / 切换模式

四、周报产品结构（核心模块🔥）

4.1 Simple模式（免费）
目标
👉 快速获取核心信息 + 激发兴趣

输出结构（固定）
标题：AI Pulse 周报 #XX

🔥 本周最重要的5件AI事

[标题]

👉 发生了什么：
（≤30字）

👉 对你意味着什么：
（用户价值）

🔗 链接

规则
3–5条（默认5条） 
每条 ≤ 3行 
禁止技术细节 
必须包含“用户意义” 

4.2 Normal模式（核心产品）

结构
1. Top3关键事件
2. 分类事件流
3. AI能力进展（核心🔥）
4. AI工具机会
5. 术语表

4.2.1 Top3模块（最高优先级）
[标题]

发生了什么：
...

为什么重要：
（行业层）

👉 对你意味着什么：
（用户层）

关注程度：⭐1–5


4.2.2 分类事件流
分类：
🧠 大模型更新 
🛠 工具 / 产品 
📊 行业动态 

每条结构：
[标题]

发生了什么：
...

适合谁：
...

👉 是否值得关注：
High / Medium / Low

👉 对你意味着什么：
...

🔗 链接

【Top3与分类关系规则】
1.Top3从全量事件中选出（评分最高 + 影响最大）

2. Top3事件必须出现在分类模块中（保证信息完整性）

3. 分类模块中若出现Top3事件：

   - 标注“（见Top3）”
   - 仅补充事实信息
   - 不重复解释与判断

4. Top3负责：
   - 重要性判断
   - 用户价值解释

5. 分类模块负责：
   - 信息覆盖
   - 事实补充
Top3	决策信息（Why + So What）
分类	事实信息（What）


🔥 4.2.3 AI能力进展（核心差异）
主题：AI现在能不能做到XXX？

当前能做到：
...

还做不到：
...

成本：
...

适合谁：
...

👉 结论：
（一句话）

4.2.4 工具机会
[工具名]

能做什么：
...

适合谁：
...

👉 是否值得试：
Yes / No

👉 对你意味着什么：
...

4.2.5 术语表
术语：
≤50字解释

五、数据来源策略与信息源爬虫清单（v1）

5.1 来源优先级（摘要）
P0：官网（最可靠，可作事实校验最高权重）
P1：AI 媒体（补充“为什么重要”，不作事实终稿唯一依据）
P2：GitHub / 开源信号
P3：社区（HN / Reddit / Product Hunt 等）
P4：社媒（可选，热度增强）

社媒策略
不作为核心依赖
抓取失败不影响主流程
仅作为热度增强信号；X 仅白名单账号（详见 `docs/SOCIAL_SOURCES.md`）

5.2 MVP 必做源（官方）

| 优先级 | 类型 | 来源 | 抓取方式 | URL / API | 用途 |
| --- | --- | --- | --- | --- | --- |
| P0 | 官方 | OpenAI News | RSS / 页面 | `https://openai.com/news/`；RSS 可试 `https://openai.com/news/rss.xml` | 模型、产品、公司公告 |
| P0 | 官方 | Anthropic News | 页面抓取 | `https://www.anthropic.com/news` | Claude、企业合作、安全动态 |
| P0 | 官方 | Google DeepMind Blog | 页面抓取 / RSS 备选 | `https://deepmind.google/blog/` | 模型、科研、产品化动态 |
| P0 | 官方 | Google AI Blog | RSS / 页面 | `https://blog.google/technology/ai/` | Gemini、Google AI 产品 |
| P0 | 官方 | Meta AI Blog | 页面抓取 | `https://ai.meta.com/blog/` | Llama、Meta AI 动态 |
| P0 | 官方 | Microsoft AI Blog | RSS / 页面 | `https://blogs.microsoft.com/ai/` | Copilot、企业 AI |
| P0 | 官方 | NVIDIA Blog AI | RSS / 页面 | `https://blogs.nvidia.com/blog/category/deep-learning/` | 算力、芯片、AI 基建 |
| P0 | 官方 | AWS Machine Learning Blog | RSS / 页面 | `https://aws.amazon.com/blogs/machine-learning/` | 云厂商 AI 产品 |
| P0 | 官方 | Apple ML Research | 页面抓取 | `https://machinelearning.apple.com/` | Apple AI / 端侧 AI |
| P0 | 官方 | Cohere Blog | 页面抓取 | `https://cohere.com/blog` | 企业模型、RAG、Agent |
| P0 | 官方 | Databricks Blog | 页面抓取 | `https://www.databricks.com/blog` | 数据 + AI 基建 |

说明：OpenAI、Anthropic、DeepMind 等官方源作为事实校验最高权重；Anthropic News、DeepMind Blog 等为持续更新的官方入口。

5.3 AI 媒体源（P1）

| 优先级 | 来源 | 抓取方式 | URL | 用途 |
| --- | --- | --- | --- | --- |
| P1 | 机器之心 | RSS / 页面 | `https://www.jiqizhixin.com/` | 中文 AI 行业动态 |
| P1 | 量子位 | RSS / 页面 | `https://www.qbitai.com/` | 中文 AI 产品、公司动态 |
| P1 | InfoQ AI | RSS / 页面 | `https://www.infoq.cn/topic/AI` | 技术产品化、企业落地 |
| P1 | TechCrunch AI | RSS | `https://techcrunch.com/category/artificial-intelligence/` | 海外融资、产品发布 |
| P1 | The Verge AI | RSS / 页面 | `https://www.theverge.com/ai-artificial-intelligence` | 消费级 AI 产品 |
| P1 | VentureBeat AI | RSS / 页面 | `https://venturebeat.com/category/ai/` | 企业 AI、商业化 |
| P1 | MIT Technology Review AI | RSS / 页面 | `https://www.technologyreview.com/topic/artificial-intelligence/` | 趋势判断 |

5.4 GitHub / 开源信号（P2）

| 优先级 | 来源 | 抓取方式 | URL / API | 用途 |
| --- | --- | --- | --- | --- |
| P2 | GitHub Search API | API | `https://api.github.com/search/repositories`（按查询筛选） | AI 热门项目 |
| P2 | GitHub 新项目 | API | 同期创建 + stars 等条件组合查询 | 发现新工具 |
| P2 | GitHub Trending | 页面抓取 | `https://github.com/trending?since=weekly` | 每周开源趋势 |
| P2 | Trendshift | 页面抓取 | `https://trendshift.io/` | GitHub + Reddit + HN 等综合热度 |

初始筛选规则（建议）：

```
stars >= 500
created_at <= 180天
description 包含：AI / LLM / agent / rag / copilot / chatbot / diffusion / multimodal
排除：纯论文复现、纯 benchmark、无 README、无最近更新
```

5.5 社区信号源（P3）

| 优先级 | 来源 | 抓取方式 | URL / API | 用途 |
| --- | --- | --- | --- | --- |
| P3 | Hacker News | API | `https://hacker-news.firebaseio.com/v0/topstories.json` | 技术圈早期信号 |
| P3 | HN Algolia Search | API | `https://hn.algolia.com/api/v1/search_by_date?query=AI` | 搜 AI 讨论 |
| P3 | Reddit r/ChatGPT | RSS | `https://www.reddit.com/r/ChatGPT/top/.rss?t=week` | 用户侧 AI 体验 |
| P3 | Reddit r/artificial | RSS | `https://www.reddit.com/r/artificial/top/.rss?t=week` | 泛 AI 热点 |
| P3 | Reddit r/MachineLearning | RSS | `https://www.reddit.com/r/MachineLearning/top/.rss?t=week` | 技术趋势信号 |
| P3 | Product Hunt | API | `https://api.producthunt.com/v2/api/graphql` | 新 AI 工具发现 |

5.6 社媒增强源（P4，非核心）

| 优先级 | 来源 | 抓取方式 | 建议 |
| --- | --- | --- | --- |
| P4 | X / Twitter | 官方 API / 第三方 / RSS 桥接 | 只抓白名单账号 |
| P4 | LinkedIn | 不建议爬 | 风控高 |
| P4 | YouTube | RSS / API | 可抓 AI 官方发布视频 |

5.7 推荐第一版抓取组合（12 个）

1. OpenAI News
2. Anthropic News
3. Google DeepMind Blog
4. Google AI Blog
5. Meta AI Blog
6. Microsoft AI Blog
7. NVIDIA AI Blog
8. AWS ML Blog
9. TechCrunch AI
10. 机器之心
11. GitHub Search API
12. Product Hunt API

5.8 统一 RawItem 数据结构（目标规范）

与入库表字段映射关系由开发在 `raw_items` / 流水线中落实；以下为逻辑字段：

```json
{
  "source_type": "official | media | github | community | social",
  "source_name": "",
  "title": "",
  "url": "",
  "published_at": "",
  "author": "",
  "raw_text": "",
  "summary": "",
  "metrics": {
    "likes": 0,
    "shares": 0,
    "comments": 0,
    "stars": 0,
    "forks": 0,
    "upvotes": 0
  },
  "crawl_time": "",
  "language": "zh | en"
}
```

5.9 开发优先级（与里程碑对齐）

第一阶段：官网源 + 媒体源 + GitHub API（与当前后端 RSS + GitHub 能力对接）

第二阶段：Product Hunt + Hacker News + Reddit

第三阶段：X 白名单增强信号

实现侧配置入口：`backend/.env` 中 `OFFICIAL_RSS_URLS` / `MEDIA_RSS_URLS` / `META_RSS_URLS` / `X_RSS_URLS` 及 `GITHUB_*`；详见 `backend/app/config.py` 与 `README.md`。

六、事件处理系统（核心技术架构🔥）

6.1 Event模型
Event = 同一事实的多来源聚合

6.2 数据结构（核心资产）
{
  "event_id": "",
  "title": "",
  "category": "",
  "sources": [],
  "published_at": "",
  "fact_status": "",
  "confidence": 0.0,
  "base_score": 0,
  "what_happened": "",
  "why_important": "",
  "what_it_means_for_you": "",
  "target_users": [],
  "attention_level": "",
  "action_suggestion": ""
}

6.3 多Agent处理流程（关键🔥）
Raw Data
↓
[Cleaner] 清洗过滤
↓
[Merger] 事件合并
↓
[Verifier] 事实校验
↓
[Scoring] 基础评分
↓
[Impact Analyst] 用户价值解释
↓
EventCard Pool
↓
[Capability Analyst] 能力判断
↓
[Composer] 周报生成
↓
[Editor] 文本优化
↓
[Auditor] 质量校验

6.4 Agent职责（精简版）
Agent	职责
Cleaner	过滤垃圾信息
Merger	事件去重
Verifier	确认事实
Scoring	计算基础分
Impact	用户价值解释
Capability	能力边界判断
Composer	周报组装
Editor	文本优化
Auditor	风险检测

七、评分体系（简化）

两层结构
第一层：机器评分
S = 热度 + 新鲜度 + 来源可信度

第二层：AI判断
是否值得关注：High / Medium / Low
是否可用：Yes / No
适用人群：...

原则
👉 不追求精确
👉 追求“用户感知正确”

八、个性化机制（保留优化）

关键词策略
用户输入1–3个关键词 
命中增加权重 

推荐逻辑
优先推荐关键词命中事件
不足部分用高分事件补齐

九、AI生成规则（必须执行）

内容规则
1. 必须结构化
2. 必须有用户价值解释
3. 使用“你”视角
4. 禁止技术堆砌
5. 不确定内容不输出

降级策略
数据不足 → 减少模块 
不确定 → 删除 
风险高 → 不发送 

十、邮件与分发

每周固定时间发送 
double opt-in 
支持退订 / 修改 / 补发 

十一、后台管理

订阅者管理 
关键词统计 
周报数据查看 
白名单管理（后续） 

十二、风险控制

社媒风险 → 降级 
事实错误 → Verifier + evidence 
噪音 → scoring + audit 
重复 → Event合并 

十三、商业化路径（强化）

免费
Simple周报 

付费（核心）
1. AI能力进展
2. 深度Top3分析
3. 历史趋势

核心价值
❗“AI判断力”，不是资讯

十四、里程碑

M1：基础抓取 + 周报生成（无社媒）
M2：多Agent + 后台
M3：社媒增强 + 个性化

与第五节「5.9 开发优先级」对应关系：
第一阶段（源）：官网 + 媒体 + GitHub API → 对齐 M1 与当前主干实现
第二阶段：Product Hunt + HN + Reddit → M1 完成后迭代数据源
第三阶段：X 白名单增强 → 对齐 M3

🎯 最终一句话（可以放封面）
AI Pulse 的核心不是信息
而是：
帮助用户判断 AI 是否值得关注、是否值得使用
