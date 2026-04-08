from __future__ import annotations

import html
import json
from typing import Any


def _keywords_lower(keywords: list[str]) -> list[str]:
    return [k.strip().lower() for k in keywords if k.strip()]


def _matches(text: str, kws: list[str]) -> bool:
    tl = text.lower()
    return any(k in tl for k in kws)


def filter_payload_for_keywords(payload: dict[str, Any], keywords: list[str]) -> tuple[dict[str, Any], bool]:
    """若关键词非空且过滤后仍有内容，返回过滤结果；否则返回原始 payload，matched=False 表示未做有效过滤（展示全文）。"""
    kws = _keywords_lower(keywords)
    if not kws:
        return payload, True

    s = payload.get("simple") or {}
    lines = [str(x) for x in (s.get("lines") or [])]
    flines = [ln for ln in lines if _matches(ln, kws)]
    footer = str(s.get("footer") or "")
    footer_ok = _matches(footer, kws)

    n = payload.get("normal") or {}
    top3_raw = n.get("top3") or []
    top3_txt: list[str] = []
    for t in top3_raw:
        if isinstance(t, dict):
            top3_txt.append(f"{t.get('title','')} {t.get('url','')}".strip())
        else:
            top3_txt.append(str(t))
    ftop = [t for t in top3_raw if _matches((f"{t.get('title','')} {t.get('url','')}" if isinstance(t, dict) else str(t)), kws)]
    fsections: list[dict[str, str]] = []
    for sec in n.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        title = str(sec.get("title", ""))
        para = str(sec.get("paragraph", ""))
        if _matches(title + para, kws):
            fsections.append({"title": title, "paragraph": para})

    glossary = payload.get("glossary") or []
    fgloss = [g for g in glossary if isinstance(g, dict) and _matches(str(g.get("term", "")) + str(g.get("explain", "")), kws)]

    has_any = bool(flines or ftop or fsections or (footer_ok and footer))
    if not has_any:
        return payload, False

    out = {
        "simple": {
            "lines": flines if flines else lines,
            "footer": footer if (footer_ok or not flines) else footer,
        },
        "normal": {
            "top3": ftop if ftop else top3_raw,
            "sections": fsections if fsections else n.get("sections", []),
        },
        "glossary": fgloss if fgloss else glossary,
    }
    return out, True


def render_issue_email(
    payload: dict[str, Any],
    mode: str,
    *,
    keyword_banner: str | None = None,
) -> tuple[str, str]:
    """返回 (html, plain_text)"""
    s = payload.get("simple") or {}
    n = payload.get("normal") or {}
    glossary = payload.get("glossary") or []

    parts_html: list[str] = []
    parts_txt: list[str] = []

    if keyword_banner:
        parts_html.append(f'<p style="color:#555;font-size:14px">{html.escape(keyword_banner)}</p>')
        parts_txt.append(keyword_banner)

    if mode == "simple":
        parts_html.append("<h2>AI Pulse · 简单模式</h2><ol>")
        for ln in s.get("lines", []):
            parts_html.append(f"<li>{html.escape(str(ln))}</li>")
        parts_html.append("</ol>")
        if s.get("footer"):
            parts_html.append(f"<p><strong>小结：</strong>{html.escape(str(s['footer']))}</p>")

        parts_txt.append("AI Pulse · 简单模式")
        for ln in s.get("lines", []):
            parts_txt.append(f"- {ln}")
        if s.get("footer"):
            parts_txt.append(f"小结：{s['footer']}")
    else:
        parts_html.append("<h2>AI Pulse · 正常模式</h2>")
        top3 = n.get("top3") or []
        if top3:
            parts_html.append("<h3>本周 AI 热点排行（Top3）</h3><ul>")
            for t in top3:
                if isinstance(t, dict):
                    title = html.escape(str(t.get("title", "")))
                    url = str(t.get("url", "")).strip()
                    if url:
                        parts_html.append(
                            f"<li><a href=\"{html.escape(url, quote=True)}\">{title}</a></li>"
                        )
                    else:
                        parts_html.append(f"<li>{title}</li>")
                else:
                    parts_html.append(f"<li>{html.escape(str(t))}</li>")
            parts_html.append("</ul>")
        for sec in n.get("sections", []):
            if not isinstance(sec, dict):
                continue
            title = html.escape(str(sec.get("title", "")))
            para_raw = str(sec.get("paragraph", ""))
            para_html = html.escape(para_raw).replace("\n", "<br/>")
            parts_html.append(f"<h3>{title}</h3><p>{para_html}</p>")
            parts_txt.append(f"## {sec.get('title','')}\n{para_raw}")

        parts_txt.insert(0, "AI Pulse · 正常模式")
        if top3:
            tlines: list[str] = []
            for t in top3:
                if isinstance(t, dict):
                    title = str(t.get("title", ""))
                    url = str(t.get("url", ""))
                    tlines.append(f"- {title} ({url})" if url else f"- {title}")
                else:
                    tlines.append(f"- {t}")
            parts_txt.insert(1, "Top3:\n" + "\n".join(tlines))

    if glossary:
        parts_html.append("<h3>本周术语表</h3><table border='0' cellpadding='6' style='border-collapse:collapse'>")
        parts_html.append("<tr><th align='left'>术语</th><th align='left'>解释</th></tr>")
        for g in glossary:
            if not isinstance(g, dict):
                continue
            term = html.escape(str(g.get("term", "")))
            expl = html.escape(str(g.get("explain", "")))
            parts_html.append(f"<tr><td>{term}</td><td>{expl}</td></tr>")
        parts_html.append("</table>")
        parts_txt.append("\n本周术语表")
        for g in glossary:
            if isinstance(g, dict):
                parts_txt.append(f"- {g.get('term')}: {g.get('explain')}")

    html_body = "<html><body style='font-family:system-ui,sans-serif;max-width:640px'>" + "\n".join(parts_html) + "</body></html>"
    text_body = "\n\n".join(parts_txt)
    return html_body, text_body


def append_subscription_footer(html_body: str, public_app_url: str, unsub_token: str, manage_token: str) -> str:
    base = public_app_url.rstrip("/")
    block = (
        f"<hr style='border:none;border-top:1px solid #eee;margin:2rem 0'/>"
        f"<p style='font-size:13px;color:#666'>"
        f"<a href=\"{html.escape(base + '/api/unsubscribe?token=' + unsub_token, quote=True)}\">退订</a>"
        f" · "
        f"<a href=\"{html.escape(base + '/manage/' + manage_token, quote=True)}\">管理关键词与模式</a>"
        f"</p>"
    )
    if "</body>" in html_body:
        return html_body.replace("</body>", block + "</body>", 1)
    return html_body + block


def parse_payload_json(raw: str) -> dict[str, Any]:
    if not raw or raw.strip() == "":
        return {"simple": {"lines": [], "footer": ""}, "normal": {"top3": [], "sections": []}, "glossary": []}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"simple": {"lines": [], "footer": ""}, "normal": {"top3": [], "sections": []}, "glossary": []}
