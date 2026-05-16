"""
新版周报 Top3：仅基于 GlobalEvent 池计算 weekly_score，写入 weekly_event_scores，并生成 normal.top3。

说明：
- max_pulse_score 第一版取 GlobalEvent 当前可观测分数的上界近似（stable_pulse、ranking_score、
  关联 raw_items.score_total 等），**未**按「仅本周窗口内历史最高分」重算时间序列（见 compute_max_pulse_score_approx）。
- active_days：优先用本周内各来源 published_at 的上海自然日去重；无足够 published_at 时为 0。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import GlobalEvent, GlobalEventSource, RawItem, WeeklyEventScore
from app.services.global_event_service import build_deduped_sources_for_api
from app.services.ranking_score import stable_pulse_score_for_global_event

_log = logging.getLogger("uvicorn.error")

SHANGHAI = ZoneInfo("Asia/Shanghai")

# 官方域名白名单（小写 host，不含 www. 前缀）
OFFICIAL_DOMAINS: frozenset[str] = frozenset(
    {
        "openai.com",
        "anthropic.com",
        "google.com",
        "blog.google",
        "googleblog.com",
        "microsoft.com",
        "nvidia.com",
        "meta.com",
        "huggingface.co",
        "github.com",
    }
)

TIER1_MEDIA_DOMAINS: frozenset[str] = frozenset(
    {
        "theverge.com",
        "techcrunch.com",
        "semianalysis.com",
        "wired.com",
        "bloomberg.com",
        "reuters.com",
        "ft.com",
    }
)


def _host_key(url: str) -> str:
    try:
        h = (urlparse((url or "").strip()).hostname or "").lower()
        if h.startswith("www."):
            h = h[4:]
        return h
    except Exception:
        return ""


def _host_in_whitelist(host: str, whitelist: frozenset[str]) -> bool:
    h = (host or "").lower().rstrip(".")
    if not h:
        return False
    for w in whitelist:
        if h == w or h.endswith("." + w):
            return True
    return False


def source_boost_from_count(n: int) -> float:
    if n <= 1:
        return 0.0
    if n == 2:
        return 3.0
    if n == 3:
        return 5.0
    if n <= 5:
        return 7.0
    return 10.0


def active_day_boost_from_days(d: int) -> float:
    if d <= 1:
        return 0.0
    if d == 2:
        return 2.0
    if d == 3:
        return 4.0
    return 6.0


def authority_boost(has_official: bool, has_media: bool) -> float:
    if has_official and has_media:
        return 8.0
    if has_official:
        return 5.0
    if has_media:
        return 3.0
    return 0.0


def calculate_weekly_score(
    *,
    max_pulse_score: float,
    independent_source_count: int,
    active_days: int,
    has_official_source: bool,
    has_authority_media: bool,
) -> tuple[float, dict[str, Any]]:
    sb = source_boost_from_count(independent_source_count)
    adb = active_day_boost_from_days(active_days)
    ab = authority_boost(has_official_source, has_authority_media)
    raw = float(max_pulse_score) + float(sb) + float(adb) + float(ab)
    final = min(100.0, raw)
    reasons: dict[str, Any] = {
        "max_pulse_score": round(max_pulse_score, 2),
        "independent_source_count": int(independent_source_count),
        "active_days": int(active_days),
        "has_official_source": bool(has_official_source),
        "has_authority_media": bool(has_authority_media),
        "source_boost": sb,
        "active_day_boost": adb,
        "authority_boost": ab,
        "new_development_boost": 0.0,
        "final_weekly_score": round(final, 2),
    }
    return round(final, 2), reasons


def shanghai_week_window_utc(period_start: date) -> tuple[datetime, datetime, date]:
    """
    period_start：期刊周一（与 WeeklyIssue.period_start 一致，按上海日历）。
    返回 [周一 00:00 上海, 下周一 00:00 上海) 的 UTC 边界，及 period_end（周日日期）。
    """
    start_local = datetime.combine(period_start, time.min, tzinfo=SHANGHAI)
    end_local = start_local + timedelta(days=7)
    period_end = (period_start + timedelta(days=6))
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc), period_end


def compute_max_pulse_score_approx(db: Session, ge: GlobalEvent) -> float:
    """
    第一版：取 GlobalEvent 当前可观测分数上界（非「本周历史滚动 max」）。
    含 stable_pulse_score、存库 ranking_score、关联 RawItem.score_total 最大值（0–100 量级）。
    """
    pulse = float(stable_pulse_score_for_global_event(ge))
    rk = float(ge.ranking_score or 0.0)
    mx_raw = db.scalar(
        select(func.max(RawItem.score_total))
        .select_from(RawItem)
        .join(GlobalEventSource, GlobalEventSource.raw_item_id == RawItem.id)
        .where(GlobalEventSource.global_event_id == ge.id)
    )
    mx_raw_f = float(mx_raw or 0.0)
    return max(pulse, rk, min(100.0, mx_raw_f))


def independent_source_keys_from_merged(merged: list[dict[str, Any]]) -> set[str]:
    keys: set[str] = set()
    for row in merged:
        u = str(row.get("url") or "")
        h = _host_key(u)
        if h:
            keys.add("d:" + h)
            continue
        sn = str(row.get("source_name") or "").strip().lower()
        if sn:
            keys.add("n:" + sn[:160])
    return keys


def _independent_sources_from_event(db: Session, ge: GlobalEvent) -> tuple[set[str], list[dict[str, Any]]]:
    merged = build_deduped_sources_for_api(db, ge)
    return independent_source_keys_from_merged(merged), merged


def _active_days_shanghai(
    merged: list[dict[str, Any]],
    ge: GlobalEvent,
    week_start_utc: datetime,
    week_end_utc: datetime,
) -> int:
    days: set[date] = set()

    def add_dt(dt: datetime | None) -> None:
        if dt is None:
            return
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt < week_start_utc or dt >= week_end_utc:
            return
        days.add(dt.astimezone(SHANGHAI).date())

    for row in merged:
        pa = row.get("published_at")
        if isinstance(pa, str):
            try:
                if pa.endswith("Z"):
                    pa = pa[:-1] + "+00:00"
                add_dt(datetime.fromisoformat(pa))
            except Exception:
                pass
        elif isinstance(pa, datetime):
            add_dt(pa)

    add_dt(ge.published_at)
    return len(days)


def _authority_flags_from_host_set(hosts: set[str]) -> tuple[bool, bool]:
    has_o = False
    has_m = False
    for d in hosts:
        if _host_in_whitelist(d, OFFICIAL_DOMAINS):
            has_o = True
        if _host_in_whitelist(d, TIER1_MEDIA_DOMAINS):
            has_m = True
    return has_o, has_m


def passes_weekly_top3_candidate(db: Session, ge: GlobalEvent, week_start_utc: datetime, week_end_utc: datetime) -> bool:
    cat = (ge.category or "").strip()
    if not cat:
        return False
    mx = compute_max_pulse_score_approx(db, ge)
    if mx <= 0:
        return False
    wh = (ge.what_happened or "").strip()
    wy = (ge.why_important or "").strip()
    wu = (ge.what_it_means_for_you or "").strip()
    if not (wh or wy or wu):
        return False
    # 本周内有活动（避免远古事件误入）
    ls = ge.last_seen_at
    if ls is None:
        return False
    if ls.tzinfo is None:
        ls = ls.replace(tzinfo=timezone.utc)
    if not (week_start_utc <= ls < week_end_utc):
        return False
    return True


def upsert_weekly_event_score_row(
    db: Session,
    *,
    report_date: date,
    period_start: date,
    period_end: date,
    ge: GlobalEvent,
    week_start_utc: datetime,
    week_end_utc: datetime,
) -> WeeklyEventScore:
    src_keys, merged = _independent_sources_from_event(db, ge)
    ind_n = len(src_keys)
    active_days = _active_days_shanghai(merged, ge, week_start_utc, week_end_utc)
    domain_hosts = {k[2:] for k in src_keys if k.startswith("d:")}
    has_o, has_m = _authority_flags_from_host_set(domain_hosts)
    mx = compute_max_pulse_score_approx(db, ge)
    sb = source_boost_from_count(ind_n)
    adb = active_day_boost_from_days(active_days)
    ab = authority_boost(has_o, has_m)
    score, reasons = calculate_weekly_score(
        max_pulse_score=mx,
        independent_source_count=ind_n,
        active_days=active_days,
        has_official_source=has_o,
        has_authority_media=has_m,
    )

    existing = db.scalars(
        select(WeeklyEventScore).where(
            WeeklyEventScore.period_start == period_start,
            WeeklyEventScore.global_event_id == ge.id,
        )
    ).first()
    if existing:
        row = existing
    else:
        row = WeeklyEventScore(
            report_date=report_date,
            period_start=period_start,
            period_end=period_end,
            global_event_id=ge.id,
        )
        db.add(row)

    row.report_date = report_date
    row.period_end = period_end
    row.weekly_score = score
    row.max_pulse_score = mx
    row.independent_source_count = ind_n
    row.active_days = active_days
    row.source_boost = sb
    row.active_day_boost = adb
    row.authority_boost = ab
    row.new_development_boost = 0.0
    row.has_official_source = has_o
    row.has_authority_media = has_m
    row.score_reasons = reasons
    db.flush()
    return row


def recompute_weekly_event_scores_for_period(db: Session, period_start: date, *, report_date: date | None = None) -> int:
    """为期刊周期重算并 upsert 所有候选 GlobalEvent 的周评分。返回写入行数。"""
    week_start_utc, week_end_utc, period_end = shanghai_week_window_utc(period_start)
    rd = report_date or period_start

    rows = db.scalars(
        select(GlobalEvent).where(
            GlobalEvent.status == "active",
            GlobalEvent.last_seen_at >= week_start_utc,
            GlobalEvent.last_seen_at < week_end_utc,
        )
    ).all()
    n = 0
    for ge in rows:
        if ge.last_seen_at and ge.last_seen_at.tzinfo is None:
            _ = ge.last_seen_at.replace(tzinfo=timezone.utc)
        if not passes_weekly_top3_candidate(db, ge, week_start_utc, week_end_utc):
            continue
        try:
            upsert_weekly_event_score_row(
                db,
                report_date=rd,
                period_start=period_start,
                period_end=period_end,
                ge=ge,
                week_start_utc=week_start_utc,
                week_end_utc=week_end_utc,
            )
            n += 1
        except Exception as exc:
            _log.warning("weekly_event_score upsert failed ge=%s: %s", ge.id, exc)
    db.commit()
    return n


def _attention_level_from_action(s: str) -> str:
    t = (s or "").strip()
    if "试用" in t or "现在" in t:
        return "1"
    if "忽略" in t:
        return "3"
    return "2"


def select_global_events_by_weekly_score(
    db: Session,
    *,
    period_start: date,
    limit: int = 40,
    min_candidates: int = 8,
) -> tuple[list[GlobalEvent], dict[str, Any]]:
    """
    按已写入的 weekly_event_scores 降序选取 GlobalEvent（须先 recompute_weekly_event_scores_for_period）。
    用于周刊候选池与多 Agent 上下文，与页面 Top3 同一套分数口径。
    """
    lim = max(1, min(int(limit), 200))
    rows = list(
        db.scalars(
            select(WeeklyEventScore)
            .where(WeeklyEventScore.period_start == period_start)
            .order_by(WeeklyEventScore.weekly_score.desc(), WeeklyEventScore.global_event_id.asc())
            .limit(lim * 2)
        ).all()
    )
    events: list[GlobalEvent] = []
    for wes in rows:
        ge = db.get(GlobalEvent, wes.global_event_id)
        if not ge or ge.status != "active":
            continue
        if not (ge.canonical_title or "").strip():
            continue
        events.append(ge)
        if len(events) >= lim:
            break
    report: dict[str, Any] = {
        "weekly_source": "global_events",
        "selection": "weekly_score",
        "period_start": period_start.isoformat(),
        "selected_global_event_ids": [int(g.id) for g in events],
        "selected_count": len(events),
        "insufficient_global_events": len(events) < max(0, int(min_candidates)),
    }
    return events, report


def build_normal_top3_payload_rows(db: Session, period_start: date, *, limit: int = 3) -> list[dict[str, Any]]:
    """按 weekly_score 降序取前 limit 条，组装 PRD normal.top3 行（含扩展字段）。"""
    rows = db.scalars(
        select(WeeklyEventScore)
        .where(WeeklyEventScore.period_start == period_start)
        .order_by(WeeklyEventScore.weekly_score.desc(), WeeklyEventScore.global_event_id.asc())
        .limit(limit)
    ).all()
    out: list[dict[str, Any]] = []
    rank = 0
    for wes in rows:
        rank += 1
        ge = db.get(GlobalEvent, wes.global_event_id)
        if not ge:
            continue
        eid = int(ge.id)
        title = (ge.title_zh or "").strip() or (ge.canonical_title or "").strip()
        url = (ge.canonical_url or "").strip() or f"/events/{eid}"
        wh = (ge.what_happened or "").strip() or (ge.summary or "")[:800]
        wy = (ge.why_important or "").strip()
        wu = (ge.what_it_means_for_you or "").strip()
        pulse = round(float(stable_pulse_score_for_global_event(ge)), 2)
        _, merged = _independent_sources_from_event(db, ge)
        source_urls = [str(x.get("url") or "").strip() for x in merged if str(x.get("url") or "").strip()][:12]
        reasons = wes.score_reasons if isinstance(wes.score_reasons, dict) else {}

        out.append(
            {
                "event_id": eid,
                "title": title[:200],
                "url": url[:2048],
                "what_happened": wh[:800],
                "why_important": wy[:800],
                "what_it_means_for_you": wu[:800],
                "attention_level": _attention_level_from_action(ge.action_suggestion),
                "category": (ge.category or "").strip()[:64],
                "category_slug": (ge.category or "").strip()[:64],
                "pulse_score": pulse,
                "ranking_score": round(float(ge.ranking_score or 0.0), 2),
                "weekly_score": round(float(wes.weekly_score or 0.0), 2),
                "weekly_rank": rank,
                "detail_url": f"/events/{eid}",
                "source_urls": source_urls,
                "weekly_score_reasons": reasons,
            }
        )
    return out


def apply_global_event_weekly_top3_to_payload(
    db: Session,
    payload: dict[str, Any],
    period_start: date,
    *,
    report_date: date | None = None,
) -> None:
    """
    重算 weekly_event_scores，用新版 normal.top3 覆盖 payload；启用短 Top3 与「不 padding」标记。
    top3_judgments 若存在，不再参与本函数（保留在 payload 内供历史阅读，前端不用于 Top3 主展示）。
    """
    rd = report_date or period_start
    try:
        recompute_weekly_event_scores_for_period(db, period_start, report_date=rd)
    except Exception as exc:
        _log.exception("recompute_weekly_event_scores_for_period failed: %s", exc)
        return

    top3_rows = build_normal_top3_payload_rows(db, period_start, limit=3)
    payload["allow_short_top3"] = True
    payload["weekly_top3_global_events_only"] = True
    norm = payload.get("normal")
    if not isinstance(norm, dict):
        norm = {}
        payload["normal"] = norm
    norm["top3"] = top3_rows
