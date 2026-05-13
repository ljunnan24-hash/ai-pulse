from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, Date, DateTime, Enum, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubscriberStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    unsubscribed = "unsubscribed"


class IssueStatus(str, enum.Enum):
    draft = "draft"
    ready = "ready"


class Subscriber(Base):
    __tablename__ = "subscribers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    mode: Mapped[str] = mapped_column(String(16), default="normal")  # simple | normal
    keywords_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(32), default=SubscriberStatus.pending.value, index=True)
    confirm_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    unsubscribe_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    manage_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    send_logs: Mapped[list["SendLog"]] = relationship(back_populates="subscriber")


class WeeklyReport(Base):
    """
    公开周报页数据源：与 weekly_issues 分离，按 report_date 唯一 upsert。
    """

    __tablename__ = "weekly_reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(32), default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    html_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="published", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class WeeklyIssue(Base):
    __tablename__ = "weekly_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    period_start: Mapped[date] = mapped_column(Date, index=True)
    simple_text: Mapped[str] = mapped_column(Text, default="")
    normal_text: Mapped[str] = mapped_column(Text, default="")
    glossary_json: Mapped[str] = mapped_column(Text, default="[]")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(16), default=IssueStatus.draft.value, index=True)
    ready_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    raw_items: Mapped[list["RawItem"]] = relationship(back_populates="issue")
    issue_events: Mapped[list["IssueEvent"]] = relationship(back_populates="issue")
    snapshots: Mapped[list["WeeklyIssueSnapshot"]] = relationship(back_populates="issue")


class WeeklyIssueSnapshot(Base):
    """
    周刊生成历史：同一 issue_id 可有多条（首次生成、--force 重跑、build_weekly_multi_agent 等）。
    weekly_issues 始终为当前最新一版；排查旧版按本表 created_at 对比 payload_json / audit_report_json。
    """

    __tablename__ = "weekly_issue_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    issue_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("weekly_issues.id", ondelete="CASCADE"), index=True
    )
    period_start: Mapped[date] = mapped_column(Date, index=True)
    simple_text: Mapped[str] = mapped_column(Text, default="")
    normal_text: Mapped[str] = mapped_column(Text, default="")
    glossary_json: Mapped[str] = mapped_column(Text, default="[]")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(16), default="")
    ready_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(64), default="")
    audit_report_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped["WeeklyIssue"] = relationship(back_populates="snapshots")


class IssueEvent(Base):
    """
    PRD：Event = 同一事实的多来源聚合。每期周刊下一组 IssueEvent，指向多条 RawItem。
    """

    __tablename__ = "issue_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("weekly_issues.id"), index=True)
    event_key: Mapped[str] = mapped_column(String(32), index=True)
    canonical_title: Mapped[str] = mapped_column(String(512), default="")
    canonical_url: Mapped[str] = mapped_column(String(1024), default="")
    summary_merged: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(64), default="")
    fact_status: Mapped[str] = mapped_column(String(32), default="unverified")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    score_total: Mapped[int] = mapped_column(Integer, default=0, index=True)
    heat_score: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sources_json: Mapped[str] = mapped_column(Text, default="[]")
    enrichment_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped["WeeklyIssue"] = relationship(back_populates="issue_events")
    raw_items: Mapped[list["RawItem"]] = relationship(back_populates="event")

    # 与 RawItem 对齐的只读别名，便于 digest / orchestrator 统一 getattr
    @property
    def title(self) -> str:
        return self.canonical_title or ""

    @property
    def summary(self) -> str:
        return self.summary_merged or ""

    @property
    def link(self) -> str:
        return self.canonical_url or ""


class RawItem(Base):
    __tablename__ = "raw_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[Optional[int]] = mapped_column(ForeignKey("weekly_issues.id"), nullable=True, index=True)
    event_id: Mapped[Optional[int]] = mapped_column(ForeignKey("issue_events.id"), nullable=True, index=True)
    source_type: Mapped[str] = mapped_column(String(32), default="rss")
    source: Mapped[str] = mapped_column(String(128), default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str] = mapped_column(String(1024), default="")
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    heat_score: Mapped[int] = mapped_column(Integer, default=0)
    score_total: Mapped[int] = mapped_column(Integer, default=0, index=True)
    score_breakdown_json: Mapped[str] = mapped_column(Text, default="{}")
    # PRD RawItem 扩展：feed_url、source_name、metrics、author、raw_text 片段等
    extra_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped[Optional["WeeklyIssue"]] = relationship(back_populates="raw_items")
    event: Mapped[Optional["IssueEvent"]] = relationship(back_populates="raw_items")


class GlobalEvent(Base):
    """全站 AI 事件（每日排行榜）；与周刊 issue_events 解耦。"""

    __tablename__ = "global_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stable_key: Mapped[str] = mapped_column(String(96), unique=True, index=True)
    canonical_title: Mapped[str] = mapped_column(String(512), default="")
    # 英文原标题的豆包译文；canonical_title 已含中文时可整段复制；列表 API 下发供前端主标题。
    title_zh: Mapped[str] = mapped_column(String(512), default="")
    canonical_url: Mapped[str] = mapped_column(String(2048), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(32), default="application", index=True)
    source_type: Mapped[str] = mapped_column(String(32), default="rss")
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    source_count: Mapped[int] = mapped_column(Integer, default=1)
    heat_score: Mapped[int] = mapped_column(Integer, default=0)
    freshness_score: Mapped[float] = mapped_column(Float, default=50.0)
    trust_score: Mapped[float] = mapped_column(Float, default=50.0)
    user_value_score: Mapped[float] = mapped_column(Float, default=50.0)
    trend_score: Mapped[float] = mapped_column(Float, default=50.0)
    weekly_score: Mapped[float] = mapped_column(Float, default=0.0)
    ranking_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    action_suggestion: Mapped[str] = mapped_column(String(32), default="先观望")
    what_happened: Mapped[str] = mapped_column(String(512), default="")
    why_important: Mapped[str] = mapped_column(String(1024), default="")
    what_it_means_for_you: Mapped[str] = mapped_column(String(1024), default="")
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    sources_json: Mapped[str] = mapped_column(Text, default="[]")
    metrics_json: Mapped[str] = mapped_column(Text, default="{}")
    capability_tags_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sources: Mapped[list["GlobalEventSource"]] = relationship(back_populates="global_event", cascade="all, delete-orphan")


class GlobalEventSource(Base):
    __tablename__ = "global_event_sources"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    global_event_id: Mapped[int] = mapped_column(ForeignKey("global_events.id", ondelete="CASCADE"), index=True)
    raw_item_id: Mapped[int] = mapped_column(ForeignKey("raw_items.id", ondelete="CASCADE"), index=True)
    source_name: Mapped[str] = mapped_column(String(256), default="")
    source_type: Mapped[str] = mapped_column(String(32), default="")
    url: Mapped[str] = mapped_column(String(2048), default="")
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    global_event: Mapped["GlobalEvent"] = relationship(back_populates="sources")


class WeeklyEventScore(Base):
    """
    新版周报：按「期刊周一 period_start」对 GlobalEvent 的周评分（weekly_score）。
    与 global_events.weekly_score 列解耦；Top3 排序与历史追溯以本表为准。
    """

    __tablename__ = "weekly_event_scores"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    report_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    global_event_id: Mapped[int] = mapped_column(ForeignKey("global_events.id", ondelete="CASCADE"), index=True)
    weekly_score: Mapped[float] = mapped_column(Float, default=0.0)
    max_pulse_score: Mapped[float] = mapped_column(Float, default=0.0)
    independent_source_count: Mapped[int] = mapped_column(Integer, default=0)
    active_days: Mapped[int] = mapped_column(Integer, default=0)
    source_boost: Mapped[float] = mapped_column(Float, default=0.0)
    active_day_boost: Mapped[float] = mapped_column(Float, default=0.0)
    authority_boost: Mapped[float] = mapped_column(Float, default=0.0)
    new_development_boost: Mapped[float] = mapped_column(Float, default=0.0)
    has_official_source: Mapped[bool] = mapped_column(default=False)
    has_authority_media: Mapped[bool] = mapped_column(default=False)
    score_reasons: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class WeeklyClickLog(Base):
    """周刊打开/点击/落地页浏览（邮件像素、重定向、公开页 ?t=）。"""

    __tablename__ = "weekly_click_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    subscriber_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("subscribers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    weekly_issue_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("weekly_issues.id", ondelete="SET NULL"), nullable=True, index=True
    )
    report_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(16), index=True)
    click_target: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    top3_slot: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    dest_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SendLog(Base):
    __tablename__ = "send_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscriber_id: Mapped[int] = mapped_column(ForeignKey("subscribers.id"), index=True)
    issue_id: Mapped[Optional[int]] = mapped_column(ForeignKey("weekly_issues.id"), nullable=True, index=True)
    # kind is used for deduplication. DuckDB-backed variants may require encoding
    # issue identity into this field, so keep it comfortably sized.
    kind: Mapped[str] = mapped_column(String(255), default="weekly")
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subscriber: Mapped["Subscriber"] = relationship(back_populates="send_logs")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AnalyticsPageView(Base):
    """站内页面浏览埋点（匿名 visitor_id + ip_hash）。"""

    __tablename__ = "analytics_page_views"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    visitor_id: Mapped[str] = mapped_column(String(40), index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    path: Mapped[str] = mapped_column(String(512), index=True)
    referrer: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class UserFeedback(Base):
    """关于页等入口的用户建议反馈。"""

    __tablename__ = "user_feedback"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    content: Mapped[str] = mapped_column(Text)
    contact: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    source_page: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="new", index=True)
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    visitor_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
