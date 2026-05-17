# Weekly Top3 item protocol

This document is the **canonical contract** for weekly Top3 rows in API payloads and in the web app. Use it in PR descriptions when changing Top3 shaping, `top3_judgments`, or detail links.

## English

**Weekly Top3 item protocol**

1. `event_id` is the primary `GlobalEvent` id for internal detail navigation.
2. `related_event_ids` must include `event_id` as the first item.
3. `source_urls` must include the primary url as the first item.
4. The frontend should use `event_id` first, then fallback to `related_event_ids[0]`, then external url, otherwise disable the detail action.
5. The payload must never produce `/events/undefined`.

## 中文

**周报 Top3 条目协议**

1. `event_id` 是站内详情跳转使用的主 `GlobalEvent` ID。
2. `related_event_ids` 必须包含 `event_id`，且 `event_id` 必须位于第一位。
3. `source_urls` 第一项必须是主事件 URL，其余为合并来源。
4. 前端跳转优先级为 `event_id` → `related_event_ids[0]` → 外链 url → 置灰。
5. payload 中不能出现会导致 `/events/undefined` 的数据。

## 生产路径（`WEEKLY_SOURCE=global_events`，推荐）

1. **候选池**：本周窗内 `global_events` 计算 **`weekly_score`**（`weekly_event_scores` 表），按分数降序取前 N 条（默认 N=40，见 `GLOBAL_EVENTS_POOL_LIMIT`）。
2. **Top3 名单**：**`weekly_score` 降序前 3**（`build_normal_top3_payload_rows`），无 LLM 选题。
3. **payload 行**：含 `event_id`、`title`（英文原标题）、`title_zh`、`primary_source_name`、`detail_url`、`weekly_score` 等；前端展示与日榜 `PulseRankingsTableLayout` 一致。

实现：`weekly_event_score_service.build_normal_top3_payload_rows`、`weekly_global_pipeline.build_global_weekly_payload`。

**文案来源**：Top3 行的 `what_happened` / `why_important` / `what_it_means_for_you` 来自日榜 **Ranking Insight** 写入的 `global_events` 字段（未 enrich 时可能较薄）。见 [`docs/SCORE_AND_RANKING.md`](SCORE_AND_RANKING.md) §5。

**可选（非默认）**：`resolve_global_weekly_top3_rows` 支持 LLM 在池内选 Top3；生产 `weekly_global_pipeline` **未调用**，Top3 固定为 `weekly_score` 前 3。

## top3_score（legacy 周报选题分，deprecated for global）

**Legacy**（`WEEKLY_SOURCE=legacy`、全量多 Agent）周报 Top3 使用 **`top3_score`** 作为选题分。**Global slim 路径不使用 `top3_score`**；候选池与 Top3 均按 **`weekly_score`**，LLM 仅写 thesis / capability / glossary，**不改 Top3 名单**。

**`top3_score` 不等于 `ranking_score`，也不是七天平均分。** 它是在基础重要性、用户价值、AI 相关性、行动价值、来源可信、新鲜度和热度之间做加权，用来判断某个事件是否适合作为本周代表性事件。

当前公式（实现见 `backend/app/services/top3_selector.py` → `calculate_top3_score`）：

```
top3_score =
  0.35 × base
+ 0.30 × user_value_score
+ 0.10 × relevance_score
+ 0.10 × actionability_score
+ 0.05 × source_trust_score
+ 0.05 × freshness_score
+ 0.05 × heat_eff
```

其中 **`base`** 优先来自 `score_total`，其次 fallback 到 `ranking_score`、`effective_ranking_score`、`pulse_score` 等基础重要性分（详见 `_resolve_base_importance`）。

权重已定稿；如需调整须产品评审并同步改代码与本文档。

## PR 说明（可复制）

**Weekly Top3 item protocol**

1. `event_id` is the primary GlobalEvent id for internal detail navigation.
2. `related_event_ids` must include `event_id` as the first item.
3. `source_urls` must include the primary url as the first item.
4. Frontend should use `event_id` first, then fallback to `related_event_ids[0]`, then external url, otherwise disable the detail action.
5. Payload must never produce `/events/undefined`.

**周报 Top3 条目协议**

1. `event_id` 是站内详情跳转使用的主 GlobalEvent ID。
2. `related_event_ids` 必须包含 `event_id`，且 `event_id` 必须位于第一位。
3. `source_urls` 第一项必须是主事件 URL，其余为合并来源。
4. 前端跳转优先级为 `event_id` → `related_event_ids[0]` → 外链 url → 置灰。
5. payload 中不能出现会导致 `/events/undefined` 的数据。
