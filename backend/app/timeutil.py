from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

BEIJING = ZoneInfo("Asia/Shanghai")


def now_beijing() -> datetime:
    return datetime.now(BEIJING)


def current_period_monday() -> date:
    """本周刊对应的周一日期（北京时间）。"""
    d = now_beijing().date()
    return d - timedelta(days=d.weekday())


def weekly_issue_short_label(period_start: date) -> str:
    """PRD 邮件标题用：公历年第几周（与期刊 period_start 对齐）。"""
    y, w, _ = period_start.isocalendar()
    return f"{y}年第{w}周"


def weekly_issue_heading_display(period_start: date) -> str:
    """邮件内主标题：AI Pulse 周报 · 2026年第19周"""
    return f"AI Pulse 周报 · {weekly_issue_short_label(period_start)}"
