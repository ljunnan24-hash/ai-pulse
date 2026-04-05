from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
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
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    send_logs: Mapped[list["SendLog"]] = relationship(back_populates="subscriber")


class WeeklyIssue(Base):
    __tablename__ = "weekly_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    period_start: Mapped[date] = mapped_column(Date, index=True)
    simple_text: Mapped[str] = mapped_column(Text, default="")
    normal_text: Mapped[str] = mapped_column(Text, default="")
    glossary_json: Mapped[str] = mapped_column(Text, default="[]")
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(16), default=IssueStatus.draft.value, index=True)
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    raw_items: Mapped[list["RawItem"]] = relationship(back_populates="issue")


class RawItem(Base):
    __tablename__ = "raw_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[int | None] = mapped_column(ForeignKey("weekly_issues.id"), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(128), default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    link: Mapped[str] = mapped_column(String(1024), default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    heat_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    issue: Mapped["WeeklyIssue" | None] = relationship(back_populates="raw_items")


class SendLog(Base):
    __tablename__ = "send_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    subscriber_id: Mapped[int] = mapped_column(ForeignKey("subscribers.id"), index=True)
    issue_id: Mapped[int | None] = mapped_column(ForeignKey("weekly_issues.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(32), default="weekly")  # weekly | confirm_digest | welcome
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    subscriber: Mapped["Subscriber"] = relationship(back_populates="send_logs")
