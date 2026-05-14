"""
RSS 信源治理：读取 feed_crawl_runs 最近 N 天数据，按 feed_url 汇总并分类 keep / watch / replace / remove。

运行（在 backend 目录、已配置 DATABASE_URL）:
  cd backend && .venv/bin/python scripts/rss_source_governance.py
  cd backend && .venv/bin/python scripts/rss_source_governance.py --days 14

输出:
  - 终端表格
  - ../reports/rss_source_governance.json（相对仓库根）
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine

# 保证从仓库任意 cwd 以 `python backend/scripts/...` 调用时也能找到 app
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))


def _reload_engine() -> Engine:
    """在 chdir 到 backend 并清空 Settings 缓存后重建 engine，避免误用其它 cwd 的 .env。"""
    import importlib

    import app.config as app_config
    import app.database as app_database

    app_config.get_settings.cache_clear()
    importlib.reload(app_database)
    return app_database.engine


@dataclass
class FeedRollup:
    feed_channel: str
    feed_url: str
    total_runs: int
    ok_count: int
    no_new_items_count: int
    invalid_feed_count: int
    fetch_failed_count: int
    parse_failed_count: int
    empty_feed_count: int
    all_filtered_count: int
    last_status: str
    last_http_status: int | None
    last_content_type: str | None
    last_error: str | None
    last_seen_at: str | None
    category: str
    flaky: bool
    notes: str = ""


_WATCH_ERR_PAT = re.compile(
    r"timeout|timed out|dns|connection reset|connection refused|"
    r"errno|temporary failure|ssl|tls|403|forbidden",
    re.I,
)


def _row_to_obs(r: dict[str, Any]) -> dict[str, Any]:
    return {
        "run_id": r["run_id"],
        "run_at": r["run_at"],
        "health_status": r.get("health_status") or "",
        "http_status": r.get("http_status"),
        "content_type": r.get("content_type"),
        "error_message": r.get("error_message"),
        "error_class": r.get("error_class"),
    }


def _last_n_observations(obs: list[dict[str, Any]], n: int) -> list[dict[str, Any]]:
    obs_sorted = sorted(obs, key=lambda x: x["run_at"], reverse=True)
    return obs_sorted[:n]


def _consecutive_invalid(last3: list[dict[str, Any]]) -> bool:
    if len(last3) < 3:
        return False
    return all(x["health_status"] == "invalid_feed" for x in last3)


def _consecutive_404_fail(last3: list[dict[str, Any]]) -> bool:
    if len(last3) < 3:
        return False

    def is_404_fail(x: dict[str, Any]) -> bool:
        if x["health_status"] != "fetch_failed":
            return False
        hs = x.get("http_status")
        return hs == 404

    return all(is_404_fail(x) for x in last3)


def _watch_candidate(obs: dict[str, Any]) -> bool:
    if obs["health_status"] != "fetch_failed":
        return False
    if obs.get("http_status") == 403:
        return True
    msg = (obs.get("error_message") or "") + " " + (obs.get("error_class") or "")
    return bool(_WATCH_ERR_PAT.search(msg))


def classify(
    channel: str,
    feed_url: str,
    observations: list[dict[str, Any]],
    min_runs_for_remove: int,
) -> tuple[str, bool, str]:
    """
    返回 (category, flaky, notes)。
    category: keep | watch | replace | remove
    """
    if not observations:
        return "watch", False, "no_rows_in_window"

    by_run = sorted(observations, key=lambda x: x["run_at"], reverse=True)
    last = by_run[0]
    last_status = last["health_status"]
    total = len(by_run)
    ok_c = sum(1 for x in by_run if x["health_status"] == "ok")
    bad_c = sum(
        1
        for x in by_run
        if x["health_status"]
        not in ("ok", "no_new_items", "all_filtered")  # all_filtered 仍算「源可用」
    )
    flaky = ok_c > 0 and bad_c > 0

    if last_status in ("ok", "no_new_items"):
        return ("keep", flaky, "last_ok_or_no_new_items")

    if last_status == "all_filtered":
        return ("keep", flaky, "last_all_filtered_feed_ok")

    last3 = _last_n_observations(by_run, 3)

    if total < min_runs_for_remove:
        if _watch_candidate(last) or last.get("http_status") == 403:
            return ("watch", flaky, f"insufficient_runs({total}<{min_runs_for_remove})_or_403")
        return ("watch", flaky, f"insufficient_runs({total}<{min_runs_for_remove})")

    if flaky and last_status not in ("invalid_feed",):
        return ("watch", flaky, "intermittent_mixed_ok_and_fail")

    if _watch_candidate(last) and not (_consecutive_invalid(last3) or _consecutive_404_fail(last3)):
        return ("watch", flaky, "403_or_transient_pattern")

    if _consecutive_invalid(last3):
        if feed_url in _REPLACE_FIRST_PARTY or "nvidia" in feed_url.lower():
            return ("replace", flaky, "last3_invalid_feed_try_known_alt")
        return ("remove", flaky, "last3_invalid_feed_no_stable_official_rss")

    if _consecutive_404_fail(last3):
        if feed_url in _REPLACE_FIRST_PARTY or "nvidia" in feed_url.lower():
            return ("replace", flaky, "last3_fetch_failed_404_try_known_alt")
        return ("remove", flaky, "last3_fetch_failed_404")

    if last_status == "fetch_failed":
        return ("watch", flaky, "fetch_failed_not_meeting_3x404_rule")

    if last_status == "invalid_feed":
        return ("watch", flaky, "invalid_feed_but_last3_not_all_invalid")

    return ("watch", flaky, f"unhandled_last={last_status}")


# 已知可替换为 FeedBurner / newsroom XML 的 NVIDIA 系旧链（治理记录里写明细）
_REPLACE_FIRST_PARTY: set[str] = {
    "https://blogs.nvidia.com/blog/feed/",
    "https://nvidianews.nvidia.com/rss",
}

# 与 docs/rss源治理记录.md 对齐：供 JSON 附带「复制到生产 .env」的静态建议（不自动改 .env）。
_SUGGESTED_REMOVE_URLS: list[str] = [
    "https://www.jiqizhixin.com/rss",
    "https://alignment.anthropic.com/feed.xml",
    "https://blog.langchain.com/rss/",
    "https://nvidianews.nvidia.com/rss",
    "https://blogs.nvidia.com/blog/feed/",
    "https://stability.ai/news?format=rss",
    "https://txt.cohere.ai/rss/",
    "https://mistral.ai/news/feed.xml",
    "https://www.anthropic.com/news/rss.xml",
    "https://www.anthropic.com/research/rss.xml",
    "https://www.databricks.com/blog/rss.xml",
    "https://www.llamaindex.ai/blog/rss.xml",
    "https://www.perplexity.ai/hub/blog/rss.xml",
]

_SUGGESTED_ADD_URLS: list[str] = [
    "https://nvidianews.nvidia.com/releases.xml",
    "https://nvidianews.nvidia.com/cats/generative_al.xml",
    "https://feeds.feedburner.com/nvidiablog",
]


def fetch_rows(engine: Engine, days: int) -> list[dict[str, Any]]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    sql = text(
        """
        SELECT feed_channel, feed_url, run_id, run_at, health_status,
               http_status, content_type, error_message, error_class
        FROM feed_crawl_runs
        WHERE job_name = 'daily_rankings'
          AND run_at >= :since
        ORDER BY feed_url ASC, run_at DESC
        """
    )
    with engine.connect() as conn:
        result = conn.execute(sql, {"since": since})
        return [dict(r) for r in result.mappings().all()]


def build_rollups(rows: list[dict[str, Any]], min_runs: int) -> list[FeedRollup]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        fu = (str(r.get("feed_url") or "")).strip()
        ch = (str(r.get("feed_channel") or "")).strip()
        key = (ch, fu)
        grouped[key].append(_row_to_obs(r))

    out: list[FeedRollup] = []
    for (ch, fu), obs in sorted(grouped.items(), key=lambda x: (x[0][0], x[0][1])):
        by_time = sorted(obs, key=lambda x: x["run_at"], reverse=True)
        last = by_time[0]
        runs = len(obs)
        cat, flaky, notes = classify(ch, fu, obs, min_runs)
        out.append(
            FeedRollup(
                feed_channel=ch,
                feed_url=fu,
                total_runs=runs,
                ok_count=sum(1 for x in obs if x["health_status"] == "ok"),
                no_new_items_count=sum(1 for x in obs if x["health_status"] == "no_new_items"),
                invalid_feed_count=sum(1 for x in obs if x["health_status"] == "invalid_feed"),
                fetch_failed_count=sum(1 for x in obs if x["health_status"] == "fetch_failed"),
                parse_failed_count=sum(1 for x in obs if x["health_status"] == "parse_failed"),
                empty_feed_count=sum(1 for x in obs if x["health_status"] == "empty_feed"),
                all_filtered_count=sum(1 for x in obs if x["health_status"] == "all_filtered"),
                last_status=last["health_status"],
                last_http_status=last.get("http_status"),
                last_content_type=last.get("content_type"),
                last_error=(last.get("error_message") or last.get("error_class") or None),
                last_seen_at=last["run_at"].isoformat() if last.get("run_at") else None,
                category=cat,
                flaky=flaky,
                notes=notes,
            )
        )
    return out


def print_table(rollups: list[FeedRollup]) -> None:
    headers = (
        "category",
        "channel",
        "last_status",
        "runs",
        "ok",
        "inv",
        "ff",
        "flaky",
        "notes",
        "feed_url",
    )
    print("\t".join(headers))
    for r in rollups:
        if r.feed_url == "" and r.feed_channel == "github":
            continue
        print(
            "\t".join(
                [
                    r.category,
                    r.feed_channel,
                    r.last_status,
                    str(r.total_runs),
                    str(r.ok_count),
                    str(r.invalid_feed_count),
                    str(r.fetch_failed_count),
                    "Y" if r.flaky else "N",
                    (r.notes or "")[:48],
                    (r.feed_url or "")[:56],
                ]
            )
        )


def main() -> None:
    os.chdir(_BACKEND_ROOT)
    ap = argparse.ArgumentParser(description="RSS governance rollup from feed_crawl_runs")
    ap.add_argument("--days", type=int, default=7, help="Lookback days (default 7)")
    ap.add_argument(
        "--min-runs-for-remove",
        type=int,
        default=3,
        help="Minimum observations before remove/replace (default 3)",
    )
    args = ap.parse_args()

    eng = _reload_engine()
    rows = fetch_rows(eng, args.days)
    rollups = build_rollups(rows, args.min_runs_for_remove)

    repo_root = _BACKEND_ROOT.parent
    reports_dir = repo_root / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    out_path = reports_dir / "rss_source_governance.json"

    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rollups:
        if r.feed_url == "" and r.feed_channel == "github":
            continue
        buckets[r.category].append(asdict(r))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "days": args.days,
        "min_runs_for_remove": args.min_runs_for_remove,
        "row_count_source": len(rows),
        "buckets": dict(buckets),
        "suggested_env_remove_urls": _SUGGESTED_REMOVE_URLS,
        "suggested_env_add_urls": _SUGGESTED_ADD_URLS,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"feed_crawl_runs rows in window: {len(rows)}")
    print(f"distinct feeds: {len(rollups)}")
    print(f"wrote {out_path}")
    print()
    print("--- suggested REMOVE (copy from production .env comma-list) ---")
    for u in _SUGGESTED_REMOVE_URLS:
        print(u)
    print()
    print("--- suggested ADD (verified NVIDIA / newsroom XML + FeedBurner) ---")
    for u in _SUGGESTED_ADD_URLS:
        print(u)
    print()
    print_table(rollups)


if __name__ == "__main__":
    main()
