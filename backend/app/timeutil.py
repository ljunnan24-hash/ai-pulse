from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

BEIJING = ZoneInfo("Asia/Shanghai")


def now_beijing() -> datetime:
    return datetime.now(BEIJING)


def current_period_monday() -> date:
    """本周刊对应的周一日期（北京时间）。"""
    d = now_beijing().date()
    return d - timedelta(days=d.weekday())
