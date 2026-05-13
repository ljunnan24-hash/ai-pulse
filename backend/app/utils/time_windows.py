"""Natural-day time windows for rankings and related jobs."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def get_yesterday_window_utc(
    tz_name: str = "Asia/Shanghai",
    *,
    reference: datetime | None = None,
) -> tuple[datetime, datetime, date]:
    """
    将 tz_name 时区下的「昨天 00:00:00」到「今天 00:00:00」（左闭右开）换算为 UTC。

    Args:
        tz_name: IANA 时区名，默认上海。
        reference: 可选；判定「今天」的参考时刻（UTC）。缺省为当前 UTC，供单测固定时间。

    Returns:
        (start_utc, end_utc, target_date)
        target_date 为上述「昨天」在该时区下的日历 date。
    """
    tz = ZoneInfo(tz_name)
    ref = reference if reference is not None else datetime.now(timezone.utc)
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)
    now_local = ref.astimezone(tz)
    today_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start_local = today_start_local - timedelta(days=1)
    start_utc = yesterday_start_local.astimezone(timezone.utc)
    end_utc = today_start_local.astimezone(timezone.utc)
    target_date = yesterday_start_local.date()
    return (start_utc, end_utc, target_date)
