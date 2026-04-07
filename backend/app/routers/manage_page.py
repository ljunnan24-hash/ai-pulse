import json
from pathlib import Path

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Subscriber, SubscriberStatus

router = APIRouter(tags=["manage"])

_templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent.parent.parent / "templates"))


@router.get("/manage/{token}", response_class=HTMLResponse)
def manage_form(request: Request, token: str, db: Session = Depends(get_db)):
    sub = db.execute(select(Subscriber).where(Subscriber.manage_token == token)).scalar_one_or_none()
    if not sub or sub.status != SubscriberStatus.active.value:
        raise HTTPException(status_code=404, detail="Invalid link")
    kws = json.loads(sub.keywords_json or "[]")
    keywords_csv = ", ".join(kws) if isinstance(kws, list) else ""
    return _templates.TemplateResponse(
        request,
        "manage.html",
        {
            "token": token,
            "mode": sub.mode,
            "keywords_csv": keywords_csv,
            "unsub_token": sub.unsubscribe_token,
        },
    )


@router.post("/manage/{token}")
def manage_save(
    token: str,
    mode: str = Form(...),
    keywords: str = Form(""),
    db: Session = Depends(get_db),
):
    sub = db.execute(select(Subscriber).where(Subscriber.manage_token == token)).scalar_one_or_none()
    if not sub or sub.status != SubscriberStatus.active.value:
        raise HTTPException(status_code=404, detail="Invalid link")
    if mode not in ("simple", "normal"):
        raise HTTPException(status_code=400, detail="Invalid mode")
    parts = [p.strip() for p in keywords.replace("，", ",").split(",") if p.strip()][:3]
    db.execute(
        update(Subscriber)
        .where(Subscriber.id == sub.id)
        .values(mode=mode, keywords_json=json.dumps(parts, ensure_ascii=False))
    )
    db.commit()
    from app.config import get_settings

    settings = get_settings()
    return RedirectResponse(url=f"{settings.frontend_url.rstrip('/')}/?preferences_saved=1", status_code=302)
