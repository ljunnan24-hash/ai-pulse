#!/usr/bin/env python3
"""
只读验收：对比 GET /api/rankings（7d）与 GET /api/events/{id} 的 Pulse Score 是否一致。

用法（需后端已启动且数据库有数据）：
  cd backend && python scripts/accept_event_detail_scores.py

环境变量：
  EVENT_SCORE_ACCEPT_URL   默认 http://127.0.0.1:8000

退出码：
  0  全部通过
  1  存在不一致或校验失败
  2  无法连接 API 或其它请求错误
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

TOLERANCE = 0.1


def _get_json(url: str) -> dict[str, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def _num(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _close(a: Any, b: Any, tol: float = TOLERANCE) -> bool:
    fa, fb = _num(a), _num(b)
    if fa is None or fb is None:
        return False
    return abs(fa - fb) <= tol + 1e-9


def main() -> int:
    base = os.environ.get("EVENT_SCORE_ACCEPT_URL", "http://127.0.0.1:8000").rstrip("/")
    rank_url = f"{base}/api/rankings?range=7d&category=all&limit=10"

    try:
        rank_body = _get_json(rank_url)
    except urllib.error.URLError as e:
        print(f"[FAIL] 无法请求 {rank_url}\n       {e}", file=sys.stderr)
        print("请先启动后端（例如 uvicorn），并设置 EVENT_SCORE_ACCEPT_URL（如需）。", file=sys.stderr)
        return 2
    except json.JSONDecodeError as e:
        print(f"[FAIL] {rank_url} 返回非 JSON: {e}", file=sys.stderr)
        return 2

    items_all = rank_body.get("items") or []
    if not isinstance(items_all, list):
        print("[FAIL] rankings 响应缺少 items 列表", file=sys.stderr)
        return 1

    picked: list[dict[str, Any]] = []
    for it in items_all:
        if not isinstance(it, dict):
            continue
        if it.get("id") is None:
            continue
        picked.append(it)
        if len(picked) >= 5:
            break

    if not picked:
        print("[WARN] 7d 榜单无可用事件，跳过明细校验。", file=sys.stderr)
        return 0

    print(f"基址: {base}")
    print(f"共检验 {len(picked)} 条（来自 limit=10 中取前 5 条有 id 的事件）\n")
    print(
        "event_id\ttitle\tranking_pulse_score\tdetail_pulse_score\t"
        "stored_ranking_score\teffective_ranking_score\tresult"
    )

    any_fail = False

    for it in picked:
        eid = it.get("id")
        title = (it.get("title") or "").replace("\t", " ").replace("\n", " ")[:120]

        rp = it.get("pulse_score")
        rr = it.get("ranking_score")

        reasons: list[str] = []

        if rp is None:
            reasons.append("rankings 缺少 pulse_score")
        if not _close(rr, rp, TOLERANCE):
            reasons.append(f"rankings ranking_score({rr}) 与 pulse_score({rp}) 不一致")

        detail_url = f"{base}/api/events/{eid}"
        try:
            detail = _get_json(detail_url)
        except urllib.error.URLError as e:
            print(f"{eid}\t{title}\t-\t-\t-\t-\tFAIL({detail_url}: {e})")
            any_fail = True
            continue
        except json.JSONDecodeError as e:
            print(f"{eid}\t{title}\t-\t-\t-\t-\tFAIL(JSON: {e})")
            any_fail = True
            continue

        dp = detail.get("pulse_score")
        dr = detail.get("ranking_score")
        ds = detail.get("stored_ranking_score")
        de = detail.get("effective_ranking_score")

        if dp is None:
            reasons.append("detail 缺少 pulse_score")
        if not _close(dr, dp, TOLERANCE):
            reasons.append(f"detail ranking_score({dr}) 与 pulse_score({dp}) 不一致")

        if rp is not None and dp is not None and not _close(rp, dp, TOLERANCE):
            reasons.append(f"榜单 pulse({rp}) 与详情 pulse({dp}) 差>{TOLERANCE}")

        # stored_ranking_score / effective_ranking_score：允许存在于 JSON；主展示以 pulse 为准（不上屏校验）。
        if reasons:
            any_fail = True
            result = "FAIL(" + "; ".join(reasons) + ")"
        else:
            result = "OK"

        rp_s = f"{_num(rp):.2f}" if _num(rp) is not None else "-"
        dp_s = f"{_num(dp):.2f}" if _num(dp) is not None else "-"
        ds_s = f"{_num(ds):.2f}" if _num(ds) is not None else "-"
        de_s = f"{_num(de):.2f}" if _num(de) is not None else "-"

        print(f"{eid}\t{title}\t{rp_s}\t{dp_s}\t{ds_s}\t{de_s}\t{result}")

    if any_fail:
        print("\n[FAIL] 存在榜单与详情 Pulse 不一致或其它校验失败。", file=sys.stderr)
        return 1

    print("\n[OK] 榜单与详情 Pulse Score 一致（允许 ±0.1 误差）。")
    print("说明：主展示以 pulse_score / ranking_score（兼容）为准；stored_ranking_score、effective_ranking_score 仅作记录，非 UI 主分数。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
