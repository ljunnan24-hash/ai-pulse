from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import insert, or_, select, update
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

def _fresh_tokens(db: Session, *, max_tries: int = 20) -> tuple[str, str, str]:
    """
    DuckDB-backed variants may not enforce UNIQUE constraints reliably.
    We proactively avoid token collisions by checking existing rows.
    """
    for _ in range(max_tries):
        confirm_t, unsub_t, manage_t = _tokens()
        hit = db.execute(
            select(Subscriber.id).where(
                or_(
                    Subscriber.confirm_token == confirm_t,
                    Subscriber.unsubscribe_token == unsub_t,
                    Subscriber.manage_token == manage_t,
                )
            )
        ).first()
        if hit is None:
            return confirm_t, unsub_t, manage_t
    raise HTTPException(status_code=503, detail="Token generation failed. Please retry.")


@router.post("/subscribe", response_model=SubscribeOut)
def subscribe(body: SubscribeIn, db: Session = Depends(get_db)) -> SubscribeOut:
    settings = get_settings()
    kws = [k.strip() for k in body.keywords if k.strip()][:3]
    keywords_json = json.dumps(kws, ensure_ascii=False)

    # DuckDB-backed MySQL variants may not enforce PK/auto-increment reliably.
    # Always treat email as the stable identity and avoid updating by id.
    existing = (
        db.execute(select(Subscriber).where(Subscriber.email == body.email).order_by(Subscriber.created_at.desc()))
        .scalars()
        .first()
    )
    if existing:
        if existing.status == SubscriberStatus.active.value:
            raise HTTPException(status_code=400, detail="This email is already subscribed.")
        if existing.status == SubscriberStatus.pending.value:
            # Pending but user may not receive the email; allow re-send with a fresh token.
            confirm_t, unsub_t, manage_t = _fresh_tokens(db)
            db.execute(
                update(Subscriber)
                .where(Subscriber.email == str(body.email))
                .where(Subscriber.status == SubscriberStatus.pending.value)
                .values(
                    mode=body.mode,
                    keywords_json=keywords_json,
                    confirm_token=confirm_t,
                    unsubscribe_token=unsub_t,
                    manage_token=manage_t,
                )
            )
            db.commit()

            confirm_link = f"{settings.public_app_url.rstrip('/')}/api/confirm?token={confirm_t}"
            unsub_link = f"{settings.public_app_url.rstrip('/')}/api/unsubscribe?token={unsub_t}"
            subject = "请确认订阅 AI Pulse"
            html = f"""<html><body style="font-family:system-ui,sans-serif">
<p>你好，</p>
<p>请点击下方链接确认订阅 <b>AI Pulse</b>（无需注册）。</p>
<p><a href="{confirm_link}">确认订阅</a></p>
<p>若按钮无效，请复制链接到浏览器打开：<br/>{confirm_link}</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
<p style="font-size:13px;color:#666">不想订阅了？点击这里：<a href="{unsub_link}">取消订阅</a></p>
</body></html>"""
            text = f"请打开链接确认订阅：{confirm_link}\n\n取消订阅：{unsub_link}"
            try:
                send_email(str(body.email), subject, html, text)
            except Exception:
                raise HTTPException(status_code=503, detail="Mail service unavailable. Check SMTP configuration.")

            return SubscribeOut()
        # unsubscribed -> allow resubscribe (update in place to avoid FK/history issues)
        confirm_t, unsub_t, manage_t = _fresh_tokens(db)
        db.execute(
            update(Subscriber)
            .where(Subscriber.email == str(body.email))
            .where(Subscriber.status == SubscriberStatus.unsubscribed.value)
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
        unsub_link = f"{settings.public_app_url.rstrip('/')}/api/unsubscribe?token={unsub_t}"
        subject = "请确认订阅 AI Pulse"
        html = f"""<html><body style="font-family:system-ui,sans-serif">
<p>你好，</p>
<p>请点击下方链接确认订阅 <b>AI Pulse</b>（无需注册）。</p>
<p><a href="{confirm_link}">确认订阅</a></p>
<p>若按钮无效，请复制链接到浏览器打开：<br/>{confirm_link}</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
<p style="font-size:13px;color:#666">不想订阅了？点击这里：<a href="{unsub_link}">取消订阅</a></p>
</body></html>"""
        text = f"请打开链接确认订阅：{confirm_link}\n\n取消订阅：{unsub_link}"
        try:
            send_email(str(body.email), subject, html, text)
        except Exception:
            raise HTTPException(status_code=503, detail="Mail service unavailable. Check SMTP configuration.")

        return SubscribeOut()

    confirm_t, unsub_t, manage_t = _fresh_tokens(db)
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
    unsub_link = f"{settings.public_app_url.rstrip('/')}/api/unsubscribe?token={unsub_t}"
    subject = "请确认订阅 AI Pulse"
    html = f"""<html><body style="font-family:system-ui,sans-serif">
<p>你好，</p>
<p>请点击下方链接确认订阅 <b>AI Pulse</b>（无需注册）。</p>
<p><a href="{confirm_link}">确认订阅</a></p>
<p>若按钮无效，请复制链接到浏览器打开：<br/>{confirm_link}</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
<p style="font-size:13px;color:#666">不想订阅了？点击这里：<a href="{unsub_link}">取消订阅</a></p>
</body></html>"""
    text = f"请打开链接确认订阅：{confirm_link}\n\n取消订阅：{unsub_link}"
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
    subs = (
        db.execute(select(Subscriber).where(Subscriber.confirm_token == token).order_by(Subscriber.created_at.desc()))
        .scalars()
        .all()
    )
    if not subs:
        return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?error=invalid_token", status_code=302)
    sub = subs[0]
    # Defensive: if duplicated tokens exist (bad data), rotate tokens for the rest so future confirms don't crash.
    if len(subs) > 1:
        for dup in subs[1:]:
            new_confirm, new_unsub, new_manage = _fresh_tokens(db)
            db.execute(
                update(Subscriber)
                .where(Subscriber.email == dup.email)
                .where(Subscriber.confirm_token == token)
                .values(confirm_token=new_confirm, unsubscribe_token=new_unsub, manage_token=new_manage)
            )
        db.commit()
    if sub.status != SubscriberStatus.pending.value:
        return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?already_confirmed=1", status_code=302)

    # Avoid ORM rowcount checks (can trigger StaleDataError on some MySQL variants).
    now = datetime.now(timezone.utc)
    subscriber_id = sub.id
    if subscriber_id is None:
        raise HTTPException(status_code=500, detail="Subscriber id is missing.")
    db.execute(
        update(Subscriber)
        .where(Subscriber.email == sub.email)
        .where(Subscriber.confirm_token == token)
        .values(status=SubscriberStatus.active.value, confirmed_at=now)
    )
    db.commit()

    # Best-effort: confirmation should succeed even if email sending fails.
    try:
        latest = (
            db.execute(
                select(WeeklyIssue)
                .where(WeeklyIssue.status == IssueStatus.ready.value)
                .order_by(WeeklyIssue.ready_at.desc())
            )
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
            db.execute(insert(SendLog).values(subscriber_id=subscriber_id, issue_id=latest.id, kind="confirm_digest"))
            db.commit()
        else:
            welcome_html = """<html><body style="font-family:system-ui,sans-serif">
<p>欢迎订阅 <b>AI Pulse</b>。</p>
<p>当前暂无已定稿周刊。我们会在每周一 9:00（北京时间）将本周精选 AI 动态发送至你的邮箱。</p>
</body></html>"""
            send_email(sub.email, "欢迎订阅 AI Pulse", welcome_html, "欢迎订阅 AI Pulse。首封完整周刊将在每周一 9:00（北京时间）送达。")
            db.execute(insert(SendLog).values(subscriber_id=subscriber_id, issue_id=None, kind="welcome"))
            db.commit()
    except Exception:
        # Confirmation already committed; ignore email/sendlog failures to avoid a bad UX.
        pass

    # UX: if the user clicked from an email and this opened a new tab/window, try to notify the original tab
    # (if still open) and close this one. Fall back to a normal redirect.
    target = f"{settings.frontend_url.rstrip('/')}/?confirmed=1"
    origin = settings.frontend_url.rstrip("/")
    html = f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="2;url={target}" />
    <title>AI Pulse</title>
  </head>
  <body style="font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 16px;">
    <h2>订阅已确认</h2>
    <p>正在返回官网…</p>
    <p><a href="{target}">如果未自动跳转，请点这里</a></p>
    <script>
      (function () {{
        try {{
          if (window.opener && !window.opener.closed) {{
            window.opener.postMessage({{ type: 'aipulse:confirmed' }}, '{origin}');
            setTimeout(function () {{ window.close(); }}, 300);
          }}
        }} catch (e) {{}}
        setTimeout(function () {{ window.location.replace('{target}'); }}, 600);
      }})();
    </script>
  </body>
</html>"""
    return HTMLResponse(content=html, status_code=200)


@router.get("/unsubscribe")
def unsubscribe(token: str, db: Session = Depends(get_db)):
    settings = get_settings()
    subs = (
        db.execute(select(Subscriber).where(Subscriber.unsubscribe_token == token).order_by(Subscriber.created_at.desc()))
        .scalars()
        .all()
    )
    if subs:
        sub = subs[0]
        # Defensive: if duplicated tokens exist (bad data), rotate tokens for the rest.
        if len(subs) > 1:
            for dup in subs[1:]:
                new_confirm, new_unsub, new_manage = _fresh_tokens(db)
                db.execute(
                    update(Subscriber)
                    .where(Subscriber.email == dup.email)
                    .where(Subscriber.unsubscribe_token == token)
                    .values(confirm_token=new_confirm, unsubscribe_token=new_unsub, manage_token=new_manage)
                )
        db.execute(
            update(Subscriber)
            .where(Subscriber.email == sub.email)
            .where(Subscriber.unsubscribe_token == token)
            .values(status=SubscriberStatus.unsubscribed.value)
        )
        db.commit()
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?unsubscribed=1", status_code=302)
