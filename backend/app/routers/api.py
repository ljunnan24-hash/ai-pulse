from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import insert, select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import SendLog, Subscriber, SubscriberStatus, WeeklyIssue, IssueStatus
from app.schemas import SubscribeIn, SubscribeOut, ManageUpdateIn
from app.services.digest_builder import (
    append_subscription_footer,
    filter_payload_for_keywords,
    parse_payload_json,
    render_issue_email,
)
from app.services.email_service import send_email

router = APIRouter(prefix="/api", tags=["api"])


def _tokens() -> tuple[str, str, str]:
    return secrets.token_urlsafe(32), secrets.token_urlsafe(32), secrets.token_urlsafe(32)


@router.post("/subscribe", response_model=SubscribeOut)
def subscribe(body: SubscribeIn, db: Session = Depends(get_db)) -> SubscribeOut:
    settings = get_settings()
    kws = [k.strip() for k in body.keywords if k.strip()][:3]
    keywords_json = json.dumps(kws, ensure_ascii=False)

    existing = db.execute(select(Subscriber).where(Subscriber.email == body.email)).scalar_one_or_none()
    if existing:
        if existing.status == SubscriberStatus.active.value:
            raise HTTPException(status_code=400, detail="This email is already subscribed.")
        if existing.status == SubscriberStatus.pending.value:
            raise HTTPException(status_code=400, detail="Please check your inbox for the confirmation link.")
        # unsubscribed -> allow resubscribe (update in place to avoid FK/history issues)
        confirm_t, unsub_t, manage_t = _tokens()
        db.execute(
            update(Subscriber)
            .where(Subscriber.id == existing.id)
            .values(
                mode=body.mode,
                keywords_json=keywords_json,
                status=SubscriberStatus.pending.value,
                confirm_token=confirm_t,
                unsubscribe_token=unsub_t,
                manage_token=manage_t,
                confirmed_at=None,
            )
        )
        db.commit()

        confirm_link = f"{settings.public_app_url.rstrip('/')}/api/confirm?token={confirm_t}"
        subject = "请确认订阅 AI Pulse"
        html = f"""<html><body style="font-family:system-ui,sans-serif">
<p>你好，</p>
<p>请点击下方链接确认订阅 <b>AI Pulse</b>（无需注册）。</p>
<p><a href="{confirm_link}">确认订阅</a></p>
<p>若按钮无效，请复制链接到浏览器打开：<br/>{confirm_link}</p>
</body></html>"""
        text = f"请打开链接确认订阅：{confirm_link}"
        try:
            send_email(str(body.email), subject, html, text)
        except Exception:
            raise HTTPException(status_code=503, detail="Mail service unavailable. Check SMTP configuration.")

        return SubscribeOut()

    confirm_t, unsub_t, manage_t = _tokens()
    sub = Subscriber(
        email=str(body.email),
        mode=body.mode,
        keywords_json=keywords_json,
        status=SubscriberStatus.pending.value,
        confirm_token=confirm_t,
        unsubscribe_token=unsub_t,
        manage_token=manage_t,
    )
    db.add(sub)
    db.commit()

    confirm_link = f"{settings.public_app_url.rstrip('/')}/api/confirm?token={confirm_t}"
    subject = "请确认订阅 AI Pulse"
    html = f"""<html><body style="font-family:system-ui,sans-serif">
<p>你好，</p>
<p>请点击下方链接确认订阅 <b>AI Pulse</b>（无需注册）。</p>
<p><a href="{confirm_link}">确认订阅</a></p>
<p>若按钮无效，请复制链接到浏览器打开：<br/>{confirm_link}</p>
</body></html>"""
    text = f"请打开链接确认订阅：{confirm_link}"
    try:
        send_email(str(body.email), subject, html, text)
    except Exception:
        db.delete(sub)
        db.commit()
        raise HTTPException(status_code=503, detail="Mail service unavailable. Check SMTP configuration.")

    return SubscribeOut()


@router.get("/confirm")
def confirm(token: str, db: Session = Depends(get_db)):
    settings = get_settings()
    sub = db.execute(select(Subscriber).where(Subscriber.confirm_token == token)).scalar_one_or_none()
    if not sub:
        return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?error=invalid_token", status_code=302)
    if sub.status != SubscriberStatus.pending.value:
        return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?already_confirmed=1", status_code=302)

    # Avoid ORM rowcount checks (can trigger StaleDataError on some MySQL variants).
    now = datetime.now(timezone.utc)
    subscriber_id = sub.id
    if subscriber_id is None:
        raise HTTPException(status_code=500, detail="Subscriber id is missing.")
    db.execute(
        update(Subscriber)
        .where(Subscriber.id == subscriber_id)
        .values(status=SubscriberStatus.active.value, confirmed_at=now)
    )
    db.commit()

    latest = (
        db.execute(select(WeeklyIssue).where(WeeklyIssue.status == IssueStatus.ready.value).order_by(WeeklyIssue.ready_at.desc()))
        .scalars()
        .first()
    )

    kws: list[str] = json.loads(sub.keywords_json or "[]")
    if latest:
        payload = parse_payload_json(latest.payload_json)
        filtered, matched = filter_payload_for_keywords(payload, kws)
        banner = None
        if kws and not matched:
            banner = "本周期暂无与关键词直接匹配的内容，以下为本期全文。"
        html_body, text_body = render_issue_email(filtered, sub.mode, keyword_banner=banner)
        html_body = append_subscription_footer(html_body, settings.public_app_url, sub.unsubscribe_token, sub.manage_token)
        text_body += f"\n\n退订: {settings.public_app_url.rstrip('/')}/api/unsubscribe?token={sub.unsubscribe_token}"
        send_email(sub.email, "AI Pulse · 最新一期", html_body, text_body)
        db.execute(
            insert(SendLog).values(subscriber_id=subscriber_id, issue_id=latest.id, kind="confirm_digest")
        )
        db.commit()
    else:
        welcome_html = """<html><body style="font-family:system-ui,sans-serif">
<p>欢迎订阅 <b>AI Pulse</b>。</p>
<p>当前暂无已定稿周刊。我们会在每周一 9:00（北京时间）将本周精选 AI 动态发送至你的邮箱。</p>
</body></html>"""
        send_email(sub.email, "欢迎订阅 AI Pulse", welcome_html, "欢迎订阅 AI Pulse。首封完整周刊将在每周一 9:00（北京时间）送达。")
        db.execute(insert(SendLog).values(subscriber_id=subscriber_id, issue_id=None, kind="welcome"))
        db.commit()

    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?confirmed=1", status_code=302)


@router.get("/unsubscribe")
def unsubscribe(token: str, db: Session = Depends(get_db)):
    settings = get_settings()
    sub = db.execute(select(Subscriber).where(Subscriber.unsubscribe_token == token)).scalar_one_or_none()
    if sub:
        db.execute(
            update(Subscriber)
            .where(Subscriber.id == sub.id)
            .values(status=SubscriberStatus.unsubscribed.value)
        )
        db.commit()
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?unsubscribed=1", status_code=302)
