# 事件评分机制（v1）— raw_items 入库规则分

> **重要**：本文档描述的是 **单条抓取条目 `raw_items.score_total`**（入库前 6 维规则分），**不是** 日榜 **Pulse**、API **综合分**，也不是周刊 **`weekly_score`**。  
> 榜单 / 周刊 / `published_at` 首发语义见：**[`docs/SCORE_AND_RANKING.md`](SCORE_AND_RANKING.md)**。

本文件定义 AI Pulse 对“单条素材（raw item）”的百分制评分，结果写入 `raw_items`，并间接影响 `global_events.user_value_score`（经 `user_value_from_raw_score`）。

## 0. 目标与原则

- **目标**：对事件进行 \(0\sim100\) 百分制评分，按分数选出 TopN 推送给用户；用户设置关键词时，命中关键词的事件优先进入 TopN，并获得加权。
- **原则**
  - **信号优先**：分数由可量化信号（社媒热度、GitHub 增长、跨源共识）驱动，而不是“来源名义优先”。
  - **可解释**：每条事件输出“分数拆解”（各维度与关键输入）。
  - **抗噪**：社媒热点可高分，但需要可信度信号与衰减机制防止噪音长期霸榜。

## 1. 事件数据模型（输入字段）

每个事件 event 至少包含：

- **内容字段**：`title`, `summary`, `url`, `published_at`
- **来源覆盖**（可多个）：
  - `has_official_post`：是否存在官网公告/博客/发布页
  - `media_count`：媒体覆盖数量（同一事件被几家媒体报道）
  - `social_platforms`：出现在哪些社媒（X/Facebook 等）
- **社媒热度字段（X/Facebook）**（缺失则按 0）
  - `likes`
  - `reposts`（或 shares）
  - `comments`（或 replies）
  - `views`
  - `account_trust_level`：账号可信等级（见 3.1 的可信度信号）
- **GitHub 热度字段**
  - `stars_7d`：7 天涨星
  - `stars_total`：总 stars（辅助）
  - `forks_7d`（可选）

## 2. 评分结构（6 维权重，总分 100）

- **实用适配性**：30
- **可触达性**：20
- **行业影响力（impact）**：20
- **商业与个人机遇**：15
- **技术落地成熟度**：10
- **长期趋势关联**：5

总分：

\[
S = practical + accessible + impact + opportunity + maturity + trend,\quad 0\le S\le 100
\]

> 注：impact 维度是本方案的核心升级点，其他维度可沿用既有规则或后续细化。

## 3. impact（行业影响力 0–20）

impact 由三部分组成：

- `social_score`（社媒热度）0–10
- `github_score`（开源热度）0–6
- `consensus_score`（跨源共识/校准）0–4

\[
impact = clip(social\_score + github\_score + consensus\_score,\ 0,\ 20)
\]

### 3.1 social_score（0–10）

输入：likes / reposts / comments / views。为防止头部爆炸，使用 log 压缩并归一到 0–10。

社媒热度原始量：

\[
H = w_v \cdot views + w_l \cdot likes + w_r \cdot reposts + w_c \cdot comments
\]

推荐默认权重（可调）：

- \(w_v=1\)
- \(w_l=20\)
- \(w_r=40\)
- \(w_c=30\)

归一（T 为“本周顶级热度阈值”）：

\[
social\_score = clip\left(10 \cdot \frac{\log(1+H)}{\log(1+T)},\ 0,\ 10\right)
\]

建议初始 \(T=20,000,000\)（按账号体量调整）。

#### 社媒可信度信号（不强制要求官网链接）

不要求事件一定带官网链接；可信度改为由 `account_trust_level` 与“跨源共识”提供。

白名单与维护规则见：`docs/SOCIAL_SOURCES.md`。

建议 `account_trust_level` 取值（示例）：

- **3（高）**：公司官方账号 / CEO / 核心研究员（白名单）
- **2（中）**：认证大号（Verified）且长期输出 AI 内容（白名单或历史可信）
- **1（低）**：普通账号/未知账号

**抗噪上限规则（仅对低可信账号生效）**：

- 若 `account_trust_level <= 1`，则 `social_score` 上限为 6
- 若 `account_trust_level >= 2`，不设上限（仍受时效衰减约束）

### 3.2 github_score（0–6）

以 **7 天涨星**为主信号：

\[
github\_score = clip\left(6 \cdot \frac{\log(1+stars\_{7d})}{\log(1+20000)},\ 0,\ 6\right)
\]

建议门槛（可选）：

- 若 `stars_7d < 5000`，可将 `github_score` 设为 0（符合“暴涨项目”定位）

### 3.3 consensus_score（0–4）

用于“事实校准 + 共识增强”，减少社媒单点噪音：

- `has_official_post=true`：+2
- `media_count >= 2`：+1
- `account_trust_level >= 2`：+1

总计封顶 4 分。

## 4. 时效衰减（建议作为 impact 的乘子）

对 impact 使用衰减系数 \(d\in[0.4,1]\)，避免旧热帖混入本周 Top：

\[
d = clip\left(1 - \frac{age\_days}{14},\ 0.4,\ 1\right)
\]
\[
impact := round(impact \cdot d)
\]

## 5. 关键词个性化（S′）与 TopN 规则

### 5.1 关键词加权

对用户关键词集合 K，计算命中数 hit（在 title+summary+url 中匹配，大小写不敏感）：

- hit=1 → +4
- hit=2 → +7
- hit≥3 → +9（bonus 封顶 10）

\[
S' = \min(100,\ S + bonus(hit))
\]

### 5.2 TopN 选择（规则 1）

- **简单模式**：Top 3–5（实现可固定为 5）
- **正常模式**：Top3（热点榜）+ sections 从更大池里取（例如 Top12）

### 5.3 关键词优先（规则 2）

若用户设置关键词：

1) 在“命中集合”里按 \(S'\) 排序选 TopN
2) 不足 N，再用全量按 \(S\) 排序补齐

## 6. 输出（必须可解释）

每条 event 输出：

- `S` 总分、6 维分
- impact 三分量（social/github/consensus）及其关键输入（views/likes/reposts/comments, stars_7d, media_count, has_official_post, account_trust_level…）
- `keyword_bonus`（该用户关键词导致的 bonus）
- `notes`（加分原因：如 trusted_account、multi_media、stars_burst 等）

