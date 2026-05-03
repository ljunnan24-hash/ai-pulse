# 社媒信号源白名单（v1）

本文件用于定义社交媒体信号源（X/Twitter、Facebook 等）的“账号可信等级（`account_trust_level`）”判定规则与建议关注名单。

> 说明：名单是可运营配置，不是代码逻辑的一部分；目标是降低噪音、减少误报，提升“热度即价值”的有效性。

## 1. account_trust_level 定义

- **3（高）**：公司官方账号 / CEO / 核心研究员 / 官方项目账号（明确与公司/产品强绑定）
- **2（中）**：认证（Verified）且长期输出 AI 内容的高质量账号（可由历史表现进入白名单）
- **1（低）**：普通账号 / 未知账号 / 无稳定历史

推荐策略（与 `docs/SCORING_V1.md` 对齐）：

- `account_trust_level <= 1`：社媒热度 `social_score` 设上限（例如 6），防止噪音霸榜
- `account_trust_level >= 2`：不设上限，但仍受“时效衰减 / 跨源共识”等约束

## 2. X / Twitter 建议关注（v1）

### 2.1 通用大模型巨头（第一梯队）

- **OpenAI（官方）**：`@OpenAI`（3）
- **ChatGPT（产品）**：`@ChatGPTapp`（3）
- **Sam Altman**：`@sama`（3）

- **Anthropic（官方）**：`@AnthropicAI`（3）
- **Dario Amodei**（CEO）：`@darioamodei`（3）
- **Google DeepMind（官方）**：`@GoogleDeepMind`（3）
- **Demis Hassabis**（CEO）：`@demishassabis`（3）

- **xAI（官方）**：`@xai`（3）
- **Elon Musk**：`@elonmusk`（3）

### 2.2 科技巨头（全栈 AI）

- **Microsoft（官方）**：`@Microsoft`（3）
- **Microsoft AI（官方）**：`@MSFTAI`（3）
- **Satya Nadella**：`@satyanadella`（3）

- **Meta AI（官方）**：`@AIatMeta`（3）
- **Meta（官方）**：`@Meta`（3）

- **Amazon / AWS（官方）**：`@awscloud`（3）

- **Apple（官方）**：`@Apple`（3）

### 2.3 算力与基础设施

- **NVIDIA（官方）**：`@nvidia`（3）
- **Jensen Huang**：`@nvidiaJensen`（3）
### 2.4 重要垂直 / 初创

- **Databricks（官方）**：`@databricks`（3）
- **Cohere（官方）**：`@cohere`（3）
- **Hugging Face（官方）**：`@huggingface`（3）
- **Stability AI（官方）**：`@StabilityAI`（3）

### 2.5 顶流 KOL / 核心研究员（可选）

> 这类账号信号强但噪音也可能更高，建议先少量引入、并通过历史效果逐步调整到（2）或剔除。

- **Yann LeCun**：`@ylecun`（2）
- **Andrej Karpathy**：`@karpathy`（2）

## 3. Facebook 建议关注（v1）

Facebook 更推荐以“官方页面”为主（3），KOL 的噪音通常更高：

- **Meta AI 官方页面**（3）
- **OpenAI 官方页面**（3）
- **Google DeepMind 官方页面**（3）
- **Microsoft 官方页面**（3）
- **NVIDIA 官方页面**（3）

> Facebook 页面的唯一标识通常是 URL / page id；建议在落地时存“页面链接 + 人类可读名称”。

## 4. 维护规则（运营）

- **新增账号**：默认先给（2），观察 2–4 周后再升（3）或降（1）
- **降级/剔除**：连续多次产生“高热度但与 AI 行业无关”的内容，降级或移出白名单
- **事件合并**：同一事件在多个账号/渠道出现时，应合并为一个事件实体（避免重复霸榜）

