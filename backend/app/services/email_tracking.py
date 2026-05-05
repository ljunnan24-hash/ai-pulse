"""邮件 HTML：打开像素 + 主链接重定向（依赖 TRACKING_HMAC_SECRET）。"""

from __future__ import annotations

import html
from urllib.parse import quote

from app.config import Settings, get_settings
from app.services.tracking_tokens import sign_tracking_payload, token_expiry_epoch


def inject_weekly_email_tracking(
    html_body: str,
    *,
    main_link: str,
    subscriber_id: int,
    weekly_issue_id: int,
    report_date_iso: str,
    settings: Settings | None = None,
) -> str:
    s = settings or get_settings()
    secret = (s.tracking_hmac_secret or "").strip()
    if not secret:
        return html_body

    base = s.public_app_url.rstrip("/")
    exp = token_expiry_epoch(days=21)

    open_payload = {
        "v": 1,
        "evt": "open",
        "sub": subscriber_id,
        "iss": weekly_issue_id,
        "rd": report_date_iso,
        "exp": exp,
    }
    open_t = sign_tracking_payload(open_payload, secret)
    open_src = f"{base}/api/track/open.gif?t={quote(open_t, safe='')}"
    pixel = (
        f'<img src="{html.escape(open_src, quote=True)}" '
        f'width="1" height="1" alt="" style="display:none" />'
    )

    click_payload = {
        "v": 1,
        "evt": "click",
        "kind": "weekly_main",
        "sub": subscriber_id,
        "iss": weekly_issue_id,
        "rd": report_date_iso,
        "dest": main_link.strip(),
        "exp": exp,
    }
    click_t = sign_tracking_payload(click_payload, secret)
    go_url = f"{base}/api/track/go?t={quote(click_t, safe='')}"

    ml = main_link.strip()
    old_href = 'href="' + html.escape(ml, quote=True) + '"'
    new_href = 'href="' + html.escape(go_url, quote=True) + '"'
    out = html_body
    if old_href in out:
        out = out.replace(old_href, new_href, 1)

    if "</body>" in out:
        out = out.replace("</body>", pixel + "</body>", 1)
    else:
        out = out + pixel
    return out
