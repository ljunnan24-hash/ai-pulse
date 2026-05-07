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
