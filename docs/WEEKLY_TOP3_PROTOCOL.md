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

## top3_score（周报选题分）

周报 Top3 使用 **`top3_score`** 作为选题分。

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
