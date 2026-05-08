#!/usr/bin/env python3
"""
排行榜评分语义验收：请求 GET /api/rankings（today / 7d / 30d），校验字段与跨区间 pulse 一致性。

用法（需后端已启动且数据库有 global_events）：
  cd backend && python scripts/accept_rankings_scores.py

自定义基址：
  set RANKINGS_ACCEPT_URL=http://127.0.0.1:8000
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any


def _get_json(url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _validate_items(items: list[dict[str, Any]], label: str) -> list[str]:
    errs: list[str] = []
    for i, it in enumerate(items):
        pid = it.get("id")
        if "pulse_score" not in it or it["pulse_score"] is None:
            errs.append(f"{label}[{i}] id={pid}: 缺少 pulse_score")
            continue
        if "effective_ranking_score" not in it or it["effective_ranking_score"] is None:
            errs.append(f"{label}[{i}] id={pid}: 缺少 effective_ranking_score")
        rs = it.get("ranking_score")
        ps = it.get("pulse_score")
        if rs is None:
            errs.append(f"{label}[{i}] id={pid}: 缺少 ranking_score")
        elif round(float(rs), 4) != round(float(ps), 4):
            errs.append(f"{label}[{i}] id={pid}: ranking_score({rs}) != pulse_score({ps})")
    return errs


def main() -> int:
    base = os.environ.get("RANKINGS_ACCEPT_URL", "http://127.0.0.1:8000").rstrip("/")
    ranges = ["today", "7d", "30d"]
    data_by_range: dict[str, dict[str, Any]] = {}

    for rk in ranges:
        url = f"{base}/api/rankings?range={rk}&category=all&limit=50"
        try:
            data_by_range[rk] = _get_json(url)
        except urllib.error.URLError as e:
            print(f"[FAIL] 无法请求 {url}\n       {e}", file=sys.stderr)
            print("请先启动后端（例如 uvicorn），并确保能访问 global_events。", file=sys.stderr)
            return 2
        except json.JSONDecodeError as e:
            print(f"[FAIL] {url} 非 JSON: {e}", file=sys.stderr)
            return 2

    all_errs: list[str] = []
    pulse_by_id: dict[int, float] = {}

    for rk in ranges:
        body = data_by_range[rk]
        items = body.get("items") or []
        if not isinstance(items, list):
            all_errs.append(f"range={rk}: items 不是列表")
            continue
        all_errs.extend(_validate_items(items, rk))
        for it in items:
            try:
                eid = int(it["id"])
                ps = float(it["pulse_score"])
            except (KeyError, TypeError, ValueError):
                continue
            if eid in pulse_by_id:
                if abs(pulse_by_id[eid] - ps) > 0.02:
                    all_errs.append(
                        f"跨区间 pulse 不一致: id={eid} 已有 {pulse_by_id[eid]} "
                        f"在 range={rk} 为 {ps}（同一事件主展示分应相同）"
                    )
            else:
                pulse_by_id[eid] = ps

    if all_errs:
        print("[FAIL] 校验未通过：")
        for e in all_errs:
            print(f"  - {e}")
        return 1

    print("[OK] 接口验收通过")
    for rk in ranges:
        n = len((data_by_range[rk].get("items") or []))
        print(f"  - range={rk}: {n} 条")
    print("  - 每条含 pulse_score、ranking_score==pulse、effective_ranking_score")
    print("  - 同一 id 在不同 range 下 pulse_score 一致（若有交集）")
    print("\n前端：RankingsPageTable 使用 pulseDisplayScore(item)，优先 pulse_score。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
