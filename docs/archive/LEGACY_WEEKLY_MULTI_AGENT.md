# Legacy 周刊：每期 RSS + 全量多 Agent（已停用）

> **状态**：自 2026-05 起已从 `generate_weekly` 生产入口移除。  
> **当前生产**：[`docs/MULTI_AGENT_V1.md`](../MULTI_AGENT_V1.md) §0（`WEEKLY_SOURCE=global_events` + `weekly_global_slim`）。

## 为什么停用

- 每期重抓 RSS、串行十余次 LLM（Verifier / Impact / EventCards / Composer…），耗时长、成本高、失败面大。
- 产品与前端已改为「日榜 `global_events` + 周刊四块（判断 / Top3 / 能力 / 术语）」。
- 日榜解读由 **`enrich_rankings`（Ranking Insight）** 承担，周刊不再重复跑 Impact。

## 旧方案流程（归档）

```
每期 RSS → raw_items / issue_events
  → Cleaner(规则) → Verifier → Impact → Scoring → EventCards(分批)
  → Capability → Trend → Glossary → Thesis → Noise → Composer
  → [Editor 可选] → [Quality Auditor 可选] → Deliverability → finalize
```

- **Top3**：`top3_selector` + Impact 的 `user_value_score`；Composer 只润色，不改 URL/顺序。
- **豆包未配置**：从 `raw_items` 确定性组装 fallback payload。
- **实现代码**（仍保留，不删）：`backend/app/services/multi_agent_orchestrator.py`
- **曾用入口**（已停用）：
  - `WEEKLY_SOURCE=legacy` + `generate_weekly`
  - `python -m app.jobs.build_weekly_multi_agent`

## 若仅需本地对照旧行为

1. 不要改生产 `.env` 的 `WEEKLY_SOURCE=global_events`。
2. 可在开发机直接 import 并调用 `MultiAgentOrchestrator().build(...)`（需自行准备 `issue_events` 候选），或阅读 `backend/scripts/dry_run_multi_agent.py`（若仍保留）。
3. 更完整的 Agent 职责与 Prompt 骨架见 [`MULTI_AGENT_V1.md`](../MULTI_AGENT_V1.md) §1–§7（标记为历史，不再更新）。

## 与当前方案对照

| 维度 | Legacy（本页） | 当前 `weekly_global_slim` |
|------|----------------|---------------------------|
| 数据源 | 每期周刊 RSS / issue_events | 过去 N 天 `global_events` |
| Top3 | Impact + top3_selector | `weekly_score` 前 3 |
| 周刊 LLM 次数 | 十余次 + Composer | 3 次（thesis / capability / glossary） |
| 事件解读 | Impact Analyst | 日榜 Ranking Insight（可选） |
| 生产命令 | （已移除） | `python -m app.jobs.generate_weekly` |
