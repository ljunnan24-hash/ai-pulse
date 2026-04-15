from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update, and_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AdminUser, Subscriber, SendLog, SubscriberStatus, WeeklyIssue, IssueStatus
from app.routers.api import _fresh_tokens  # reuse collision-safe token generation
from app.services.email_service import send_email
from app.services.digest_builder import (
    append_subscription_footer,
    filter_payload_for_keywords,
    parse_payload_json,
    render_issue_email,
)


router = APIRouter(prefix="/admin", tags=["admin"])

# Optional deps (preferred in production)
try:
    from passlib.context import CryptContext  # type: ignore

    _pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
except Exception:  # pragma: no cover
    _pwd = None

try:
    import jwt as _pyjwt  # type: ignore
except Exception:  # pragma: no cover
    _pyjwt = None


class LoginIn(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=1, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MeOut(BaseModel):
    id: int
    username: str


class MetricsOut(BaseModel):
    total: int
    active_confirmed: int
    pending: int
    unsubscribed: int
    top_keywords: list[dict[str, Any]]


class SubscriberRowOut(BaseModel):
    id: int
    email: str
    status: str
    mode: str
    keywords: list[str]
    keywords_json: str
    created_at: str
    confirmed_at: str | None
    last_sent_at: str | None
    send_count: int


def _parse_keywords(keywords_json: str | None) -> list[str]:
    if not keywords_json:
        return []
    try:
        data = json.loads(keywords_json)
    except Exception:
        return []
    if isinstance(data, list):
        out: list[str] = []
        for x in data:
            if isinstance(x, str):
                t = x.strip()
                if t and t not in out:
                    out.append(t)
        return out
    if isinstance(data, dict) and "keywords" in data and isinstance(data["keywords"], list):
        out = []
        for x in data["keywords"]:
            if isinstance(x, str):
                t = x.strip()
                if t and t not in out:
                    out.append(t)
        return out
    return []


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + pad).encode("ascii"))


def _jwt_encode_hs256(payload: dict[str, Any], secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    h = _b64url(json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    p = _b64url(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    sig = hmac.new(secret.encode("utf-8"), f"{h}.{p}".encode("ascii"), hashlib.sha256).digest()
    s = _b64url(sig)
    return f"{h}.{p}.{s}"


def _jwt_decode_hs256(token: str, secret: str) -> dict[str, Any]:
    try:
        h, p, s = token.split(".")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    expected = hmac.new(secret.encode("utf-8"), f"{h}.{p}".encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(_b64url(expected), s):
        raise HTTPException(status_code=401, detail="Invalid token.")
    payload = json.loads(_b64url_decode(p).decode("utf-8"))
    exp = payload.get("exp")
    if isinstance(exp, (int, float)) and int(exp) < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return payload


def _hash_password(password: str) -> str:
    # Prefer bcrypt if passlib is installed, else fall back to pbkdf2.
    if _pwd is not None:
        try:
            return _pwd.hash(password)
        except Exception:
            # If bcrypt backend is broken in this environment, fall back to pbkdf2.
            pass
    # pbkdf2 fallback (keeps dev unblocked; still safe-ish, but not bcrypt)
    iters = 210_000
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters, dklen=32)
    return f"pbkdf2_sha256${iters}${_b64url(salt)}${_b64url(dk)}"


def _verify_password(password: str, stored: str) -> bool:
    if stored.startswith("pbkdf2_sha256$"):
        try:
            _algo, it_s, salt_s, dk_s = stored.split("$", 3)
            iters = int(it_s)
            salt = _b64url_decode(salt_s)
            dk = _b64url_decode(dk_s)
            test = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iters, dklen=len(dk))
            return hmac.compare_digest(test, dk)
        except Exception:
            return False
    if _pwd is None:
        return False
    try:
        return bool(_pwd.verify(password, stored))
    except Exception:
        return False


def _issue_jwt(*, admin_id: int, username: str) -> tuple[str, int]:
    settings = get_settings()
    if not settings.admin_jwt_secret:
        raise HTTPException(status_code=500, detail="ADMIN_JWT_SECRET not configured.")
    exp_seconds = int(settings.admin_jwt_expires_hours) * 3600
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(admin_id),
        "username": username,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=exp_seconds)).timestamp()),
        "typ": "admin",
    }
    if _pyjwt is not None:
        token = _pyjwt.encode(payload, settings.admin_jwt_secret, algorithm="HS256")
    else:
        token = _jwt_encode_hs256(payload, settings.admin_jwt_secret)
    return token, exp_seconds


def _parse_bearer(request: Request) -> str | None:
    h = request.headers.get("authorization") or request.headers.get("Authorization")
    if not h:
        return None
    parts = h.split(" ", 1)
    if len(parts) != 2:
        return None
    scheme, token = parts[0].strip().lower(), parts[1].strip()
    if scheme != "bearer" or not token:
        return None
    return token


def require_admin(request: Request) -> dict[str, Any]:
    settings = get_settings()
    token = _parse_bearer(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    try:
        if _pyjwt is not None:
            payload = _pyjwt.decode(token, settings.admin_jwt_secret, algorithms=["HS256"])
        else:
            payload = _jwt_decode_hs256(token, settings.admin_jwt_secret)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    if payload.get("typ") != "admin":
        raise HTTPException(status_code=401, detail="Invalid token type.")
    return payload


@router.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    u = (
        db.execute(select(AdminUser).where(AdminUser.username == body.username.strip()))
        .scalars()
        .first()
    )
    if not u or int(u.is_active or 0) != 1:
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not _verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    now = datetime.now(timezone.utc)
    db.execute(update(AdminUser).where(AdminUser.id == u.id).values(last_login_at=now))
    db.commit()

    token, exp_seconds = _issue_jwt(admin_id=u.id, username=u.username)
    return TokenOut(access_token=token, expires_in=exp_seconds)


@router.get("/auth/me", response_model=MeOut)
def me(payload: dict[str, Any] = Depends(require_admin), db: Session = Depends(get_db)) -> MeOut:
    admin_id = int(payload.get("sub") or 0)
    u = db.execute(select(AdminUser).where(AdminUser.id == admin_id)).scalars().first()
    if not u or int(u.is_active or 0) != 1:
        raise HTTPException(status_code=401, detail="Unauthorized.")
    return MeOut(id=u.id, username=u.username)


@router.get("/metrics", response_model=MetricsOut)
def metrics(payload: dict[str, Any] = Depends(require_admin), db: Session = Depends(get_db)) -> MetricsOut:
    _ = payload
    total = int(db.execute(select(func.count(Subscriber.id))).scalar_one() or 0)
    active_confirmed = int(
        db.execute(
            select(func.count(Subscriber.id)).where(
                and_(Subscriber.status == SubscriberStatus.active.value, Subscriber.confirmed_at.is_not(None))
            )
        ).scalar_one()
        or 0
    )
    pending = int(db.execute(select(func.count(Subscriber.id)).where(Subscriber.status == SubscriberStatus.pending.value)).scalar_one() or 0)
    unsubscribed = int(
        db.execute(select(func.count(Subscriber.id)).where(Subscriber.status == SubscriberStatus.unsubscribed.value)).scalar_one() or 0
    )

    # Top keywords (MVP): read a capped number of active subscribers and count in Python.
    subs = (
        db.execute(
            select(Subscriber.keywords_json)
            .where(and_(Subscriber.status == SubscriberStatus.active.value, Subscriber.confirmed_at.is_not(None)))
            .order_by(Subscriber.confirmed_at.desc())
            .limit(5000)
        )
        .scalars()
        .all()
    )
    counts: dict[str, int] = {}
    for kj in subs:
        for k in _parse_keywords(kj):
            kk = k.lower()
            counts[kk] = counts.get(kk, 0) + 1
    top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:20]
    top_keywords = [{"keyword": k, "active_confirmed_count": c} for k, c in top]
    return MetricsOut(
        total=total,
        active_confirmed=active_confirmed,
        pending=pending,
        unsubscribed=unsubscribed,
        top_keywords=top_keywords,
    )


@router.get("/subscribers", response_model=list[SubscriberRowOut])
def list_subscribers(
    q: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
    limit: int = 50,
    offset: int = 0,
    payload: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[SubscriberRowOut]:
    _ = payload
    limit = max(1, min(int(limit), 200))
    offset = max(0, int(offset))

    # Aggregates from send_logs
    agg = (
        select(
            SendLog.subscriber_id.label("sid"),
            func.count(SendLog.id).label("send_count"),
            func.max(SendLog.sent_at).label("last_sent_at"),
        )
        .group_by(SendLog.subscriber_id)
        .subquery()
    )

    stmt = (
        select(
            Subscriber,
            func.coalesce(agg.c.send_count, 0).label("send_count"),
            agg.c.last_sent_at.label("last_sent_at"),
        )
        .outerjoin(agg, agg.c.sid == Subscriber.id)
        .order_by(Subscriber.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if q:
        qq = q.strip()
        if qq:
            stmt = stmt.where(Subscriber.email.like(f"%{qq}%"))
    if status:
        ss = status.strip()
        if ss in {SubscriberStatus.active.value, SubscriberStatus.pending.value, SubscriberStatus.unsubscribed.value}:
            stmt = stmt.where(Subscriber.status == ss)

    rows = db.execute(stmt).all()

    out: list[SubscriberRowOut] = []
    kw = (keyword or "").strip().lower()
    for sub, send_count, last_sent_at in rows:
        keywords = _parse_keywords(sub.keywords_json)
        if kw and not any(k.lower() == kw for k in keywords):
            continue
        out.append(
            SubscriberRowOut(
                id=int(sub.id),
                email=str(sub.email),
                status=str(sub.status),
                mode=str(sub.mode),
                keywords=keywords,
                keywords_json=sub.keywords_json or "[]",
                created_at=str(getattr(sub, "created_at", "")),
                confirmed_at=str(sub.confirmed_at) if sub.confirmed_at else None,
                last_sent_at=str(last_sent_at) if last_sent_at else None,
                send_count=int(send_count or 0),
            )
        )
    return out


@router.get("/subscribers/export.csv")
def export_subscribers_csv(
    status: str | None = None,
    keyword: str | None = None,
    payload: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = payload
    ss = (status or "").strip()
    kw = (keyword or "").strip().lower()
    stmt = select(Subscriber).order_by(Subscriber.created_at.desc())
    if ss in {SubscriberStatus.active.value, SubscriberStatus.pending.value, SubscriberStatus.unsubscribed.value}:
        stmt = stmt.where(Subscriber.status == ss)

    def gen():
        # UTF-8 BOM for Excel
        yield "\ufeff"
        yield "id,email,status,mode,keywords,created_at,confirmed_at\n"
        for sub in db.execute(stmt).scalars().yield_per(1000):
            keywords = _parse_keywords(sub.keywords_json)
            if kw and not any(k.lower() == kw for k in keywords):
                continue
            kws = ";".join(keywords)
            email_csv = str(sub.email).replace('"', '""')
            kws_csv = kws.replace('"', '""')
            line = f'{sub.id},"{email_csv}",{sub.status},{sub.mode},"{kws_csv}",{sub.created_at},{sub.confirmed_at or ""}\n'
            yield line

    return StreamingResponse(gen(), media_type="text/csv")


@router.get("/subscribers/by-id/{subscriber_id}", response_model=SubscriberRowOut)
def get_subscriber(
    subscriber_id: int,
    payload: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SubscriberRowOut:
    _ = payload
    agg = (
        select(
            func.count(SendLog.id).label("send_count"),
            func.max(SendLog.sent_at).label("last_sent_at"),
        )
        .where(SendLog.subscriber_id == subscriber_id)
        .subquery()
    )
    row = (
        db.execute(
            select(
                Subscriber,
                func.coalesce(agg.c.send_count, 0).label("send_count"),
                agg.c.last_sent_at.label("last_sent_at"),
            ).where(Subscriber.id == subscriber_id)
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Subscriber not found.")
    sub, send_count, last_sent_at = row
    keywords = _parse_keywords(sub.keywords_json)
    return SubscriberRowOut(
        id=int(sub.id),
        email=str(sub.email),
        status=str(sub.status),
        mode=str(sub.mode),
        keywords=keywords,
        keywords_json=sub.keywords_json or "[]",
        created_at=str(getattr(sub, "created_at", "")),
        confirmed_at=str(sub.confirmed_at) if sub.confirmed_at else None,
        last_sent_at=str(last_sent_at) if last_sent_at else None,
        send_count=int(send_count or 0),
    )


@router.post("/subscribers/by-id/{subscriber_id}/unsubscribe")
def admin_unsubscribe(
    subscriber_id: int,
    payload: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = payload
    sub = db.execute(select(Subscriber).where(Subscriber.id == subscriber_id)).scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found.")
    if sub.status == SubscriberStatus.unsubscribed.value:
        return {"ok": True}
    db.execute(update(Subscriber).where(Subscriber.id == subscriber_id).values(status=SubscriberStatus.unsubscribed.value))
    db.commit()
    return {"ok": True}


@router.post("/subscribers/by-id/{subscriber_id}/resend-confirmation")
def admin_resend_confirmation(
    subscriber_id: int,
    payload: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = payload
    settings = get_settings()
    sub = db.execute(select(Subscriber).where(Subscriber.id == subscriber_id)).scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found.")
    if sub.status == SubscriberStatus.active.value and sub.confirmed_at is not None:
        raise HTTPException(status_code=400, detail="Subscriber is already confirmed.")

    confirm_t, unsub_t, manage_t = _fresh_tokens(db)
    db.execute(
        update(Subscriber)
        .where(Subscriber.id == subscriber_id)
        .values(
            status=SubscriberStatus.pending.value,
            confirm_token=confirm_t,
            unsubscribe_token=unsub_t,
            manage_token=manage_t,
            confirmed_at=None,
        )
    )
    db.commit()

    email = str(sub.email).strip()
    confirm_link = f"{settings.public_app_url.rstrip('/')}/api/confirm?token={confirm_t}&email={email}"
    unsub_link = f"{settings.public_app_url.rstrip('/')}/api/unsubscribe?token={unsub_t}"
    subject = "请确认订阅 AI Pulse"
    html = f"""<html><body style="font-family:system-ui,sans-serif">
<p>你好，</p>
<p style="color:#666;font-size:13px">此确认邮件发送至：<b>{email}</b></p>
<p>请点击下方链接确认订阅 <b>AI Pulse</b>（无需注册）。</p>
<p><a href="{confirm_link}">确认订阅</a></p>
<p>若按钮无效，请复制链接到浏览器打开：<br/>{confirm_link}</p>
<hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
<p style="font-size:13px;color:#666">不想订阅了？点击这里：<a href="{unsub_link}">取消订阅</a></p>
</body></html>"""
    text = f"此确认邮件发送至：{email}\n\n请打开链接确认订阅：{confirm_link}\n\n取消订阅：{unsub_link}"
    send_email(email, subject, html, text)
    return {"ok": True}


@router.post("/subscribers/by-id/{subscriber_id}/resend-latest-weekly")
def admin_resend_latest_weekly(
    subscriber_id: int,
    payload: dict[str, Any] = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _ = payload
    settings = get_settings()
    sub = db.execute(select(Subscriber).where(Subscriber.id == subscriber_id)).scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found.")
    if sub.status != SubscriberStatus.active.value or sub.confirmed_at is None:
        raise HTTPException(status_code=400, detail="Subscriber is not active/confirmed.")

    issue = (
        db.execute(
            select(WeeklyIssue)
            .where(WeeklyIssue.status == IssueStatus.ready.value)
            .order_by(WeeklyIssue.ready_at.desc())
        )
        .scalars()
        .first()
    )
    if not issue:
        raise HTTPException(status_code=404, detail="No ready issue.")

    email = str(sub.email).strip()
    kws = _parse_keywords(sub.keywords_json)
    payload_data = parse_payload_json(issue.payload_json)
    filtered, matched = filter_payload_for_keywords(payload_data, kws)
    banner = None
    if kws and not matched:
        banner = "本周期暂无与关键词直接匹配的内容，以下为本期全文。"
    html_body, text_body = render_issue_email(
        filtered,
        sub.mode,
        keyword_banner=banner,
        recipient_email=email,
    )
    html_body = append_subscription_footer(html_body, settings.public_app_url, sub.unsubscribe_token, sub.manage_token)
    text_body += f"\n\n退订: {settings.public_app_url.rstrip('/')}/api/unsubscribe?token={sub.unsubscribe_token}"
    send_email(email, "AI Pulse · 最新一期（管理员补发）", html_body, text_body)

    # Log as manual resend (best-effort)
    try:
        db.add(SendLog(subscriber_id=sub.id, issue_id=issue.id, kind="manual_resend"))
        db.commit()
    except Exception:
        db.rollback()
    return {"ok": True}

