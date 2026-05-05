"""
邮件通知专用 payload：与 PRD 周报内容分离，强制短文本、少链接、无外链。
"""

from __future__ import annotations

import html
import json
import re
from typing import Any
from urllib.parse import urlparse

from app.config import Settings, get_settings
from app.services.payload_schema import ValidationError

MAX_EMAIL_CHARS = 600
# 整封通知内可见 http(s) 链接总数（通常为 weekly_url 一处）
MAX_EMAIL_LINKS = 1
MAX_BODY_HTTP_LINKS = 1
MAX_EXTERNAL_LINKS = 0
MAX_TOP_ITEMS = 3

# 主题行额外禁止（营销高危）
SUBJECT_BANNED_WORDS = ("免费", "机会", "赚钱", "暴利")

# 正文禁用词（第一阶段）
BODY_BANNED_WORDS = (
    "赚钱",
    "副业",
    "暴利",
    "套利",
    "领取",
    "福利",
    "加微信",
    "VX",
    "扫码",
    "私聊",
    "工具机会",
    "零成本",
    "金融交易",
    "量化交易",
)

# 生成阶段替换高危词（不改变事实过多前提下降低误判）
_SCRUB_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("免费Claude", "Claude 在线服务"),
    ("免费访问", "在线访问"),
    ("工具机会", "本周工具观察"),
    ("零成本", "低成本"),
    ("免费", "可在线使用"),
)

# 兼容旧 scrub / LLM 输出清洗（合并默认字段时替换）
BANNED_WORDS = list(BODY_BANNED_WORDS) + ["免费Claude", "免费访问", "免费"]

_URL_RE = re.compile(r"https?://[^\s\)\]>\'\"]+", re.IGNORECASE)
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001F9FF"
    "\u2600-\u26FF"
    "\u2700-\u27BF"
    "]",
    re.UNICODE,
)


def weekly_email_allowed_hosts(settings: Settings | None = None) -> set[str]:
    """邮件阶段允许的链接域名：仅 weekly_public_base_url 对应主机。"""
    s = settings or get_settings()
    raw = (s.weekly_public_base_url or "").strip()
    try:
        h = (urlparse(raw).hostname or "").lower()
    except Exception:
        h = ""
    out: set[str] = set()
    if h:
        out.add(h)
        if h.startswith("www."):
            out.add(h[4:])
    return out


def allowed_hosts_from_urls(*urls: str) -> set[str]:
    hosts: set[str] = set()
    for raw in urls:
        if not raw:
            continue
        try:
            h = (urlparse(raw.strip()).hostname or "").lower()
            if h:
                hosts.add(h)
                if h.startswith("www."):
                    hosts.add(h[4:])
        except Exception:
            continue
    return hosts


def extract_http_urls(*parts: str) -> list[str]:
    out: list[str] = []
    for p in parts:
        if not p:
            continue
        out.extend(_URL_RE.findall(p))
    return out


def host_allowed(url: str, allowed: set[str]) -> bool:
    try:
        h = (urlparse(url).hostname or "").lower()
        if not h:
            return False
        if h in allowed:
            return True
        if h.startswith("www.") and h[4:] in allowed:
            return True
        return any(h.endswith("." + a) for a in allowed if "." in a)
    except Exception:
        return False


def duplicated_content_detected(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return False
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    if len(lines) >= 2 and len(lines) != len(set(lines)):
        return True
    paras = [p.strip() for p in re.split(r"\n\s*\n", t) if p.strip()]
    if len(paras) != len(set(paras)):
        return True
    return False


def count_numbered_summary_lines(body: str) -> int:
    """统计类似「1. xxx」「1、xxx」的条目行（本周重点摘要）。"""
    if not body:
        return 0
    n = 0
    for ln in body.splitlines():
        s = ln.strip()
        if re.match(r"^\d{1,2}[\.\)、]\s*\S", s):
            n += 1
    return n


def collect_email_text_bundle(ep: dict[str, Any]) -> str:
    parts = [
        str(ep.get("subject") or ""),
        str(ep.get("preheader") or ""),
        str(ep.get("body_text") or ""),
    ]
    bh = str(ep.get("body_html") or "")
    if bh:
        parts.append(re.sub(r"<[^>]+>", " ", bh))
    return "\n".join(parts)


def validate_email_payload(
    ep: dict[str, Any],
    *,
    settings: Settings | None = None,
) -> list[ValidationError]:
    """
    第一阶段硬规则：长度、链接数、主链接域名、主题/正文禁词、重复段落。
    """
    s = settings or get_settings()
    hosts = weekly_email_allowed_hosts(s)
    # 与 publish_weekly_page 共用同一前缀规则，避免循环依赖故延迟导入
    from app.services.publish_weekly_page import weekly_main_link_prefix

    errs: list[ValidationError] = []
    if not isinstance(ep, dict):
        return [ValidationError(path="$.email_payload", message="must be an object")]

    req = ("subject", "preheader", "body_text", "main_link", "unsubscribe_text")
    for k in req:
        if k not in ep or not isinstance(ep.get(k), str):
            errs.append(ValidationError(f"$.email_payload.{k}", "must be a non-empty string"))
    if errs:
        return errs

    subject = str(ep.get("subject") or "")
    preheader = str(ep.get("preheader") or "")
    body = str(ep.get("body_text") or "")
    body_html = str(ep.get("body_html") or "")

    if len(body) > MAX_EMAIL_CHARS:
        errs.append(
            ValidationError(
                "$.email_payload.body_text",
                f"must be <= {MAX_EMAIL_CHARS} characters",
            )
        )

    prefix = weekly_main_link_prefix(settings=s)
    main_link = str(ep.get("main_link") or "").strip()
    if not main_link.startswith(prefix):
        errs.append(
            ValidationError(
                "$.email_payload.main_link",
                f"must start with {prefix}",
            )
        )

    for w in SUBJECT_BANNED_WORDS:
        if w in subject:
            errs.append(ValidationError("$.email_payload.subject", f"banned word in subject: {w}"))

    for w in BODY_BANNED_WORDS:
        if w in body:
            errs.append(ValidationError("$.email_payload.body_text", f"banned word in body: {w}"))

    bundle = collect_email_text_bundle(ep)
    if _EMOJI_RE.search(bundle):
        errs.append(ValidationError("$.email_payload.body_text", "emoji not allowed"))

    if duplicated_content_detected(body):
        errs.append(ValidationError("$.email_payload.body_text", "duplicate blocks or lines detected"))

    n_items = count_numbered_summary_lines(body)
    if n_items > MAX_TOP_ITEMS:
        errs.append(
            ValidationError(
                "$.email_payload.body_text",
                f"too many numbered summary lines ({n_items} > {MAX_TOP_ITEMS})",
            )
        )

    body_urls = list(dict.fromkeys(extract_http_urls(body)))
    if len(body_urls) > MAX_BODY_HTTP_LINKS:
        errs.append(
            ValidationError(
                "$.email_payload.body_text",
                f"too many links in body ({len(body_urls)} > {MAX_BODY_HTTP_LINKS})",
            )
        )

    url_fields_raw = extract_http_urls(subject, preheader, body, body_html)
    url_fields = list(dict.fromkeys(url_fields_raw))
    external = [u for u in url_fields if not host_allowed(u, hosts)]
    if len(external) > MAX_EXTERNAL_LINKS:
        errs.append(
            ValidationError(
                "$.email_payload",
                f"external links not allowed (found {len(external)})",
            )
        )

    if len(url_fields) > MAX_EMAIL_LINKS:
        errs.append(
            ValidationError(
                "$.email_payload",
                f"too many http links overall ({len(url_fields)} > {MAX_EMAIL_LINKS})",
            )
        )

    return errs


def validate_email_payload_hard(
    ep: dict[str, Any],
    *,
    allowed_hosts: set[str],
) -> list[ValidationError]:
    """兼容旧调用：忽略 allowed_hosts，统一走 weekly_public_base_url 规则。"""
    _ = allowed_hosts
    return validate_email_payload(ep, settings=get_settings())


def format_email_validation_errors(errs: list[ValidationError]) -> str:
    return "; ".join(f"{e.path}: {e.message}" for e in errs)


def build_notification_body_html(body_text: str, main_link: str) -> str:
    """确定性 HTML：避免模型直接生成带外链的复杂 HTML。"""
    esc = html.escape(body_text or "")
    esc = esc.replace("\n\n", "</p><p style='margin:12px 0'>")
    esc = esc.replace("\n", "<br/>")
    ml = html.escape(main_link.strip(), quote=True)
    link_line = (
        f"<p style='margin-top:16px'><a href=\"{ml}\">查看完整周报</a></p>"
        if main_link.strip()
        else ""
    )
    return (
        "<div style='font-family:system-ui,sans-serif;max-width:560px;line-height:1.55;color:#222'>"
        f"<p style='margin:12px 0'>{esc}</p>{link_line}</div>"
    )


def scrub_email_copy(text: str) -> str:
    t = text or ""
    for a, b in _SCRUB_REPLACEMENTS:
        t = t.replace(a, b)
    return t


def merge_email_payload_defaults(ep: dict[str, Any], *, weekly_main_link: str) -> dict[str, Any]:
    out = dict(ep)
    out["main_link"] = str(out.get("main_link") or weekly_main_link).strip()
    for key in ("subject", "preheader", "body_text", "unsubscribe_text"):
        if key in out and isinstance(out[key], str):
            out[key] = scrub_email_copy(out[key])
    bt = str(out.get("body_text") or "").strip()
    out["body_text"] = bt
    if not str(out.get("body_html") or "").strip():
        out["body_html"] = build_notification_body_html(bt, out["main_link"])
    try:
        rs = int(float(out.get("risk_score", 0)))
        out["risk_score"] = max(0, min(100, rs))
    except Exception:
        out["risk_score"] = 0
    rn = out.get("risk_notes")
    out["risk_notes"] = rn if isinstance(rn, list) else []
    return out


def deterministic_email_payload(
    prd: dict[str, Any],
    *,
    weekly_main_link: str,
    subject_line: str,
) -> dict[str, Any]:
    """不调用 LLM 的最小通知邮件（硬规则友好）。"""
    lines: list[str] = ["你好，", "", "你订阅的 AI Pulse 周报已更新。", "", "本周重点："]
    normal = prd.get("normal") if isinstance(prd.get("normal"), dict) else {}
    top3 = normal.get("top3") if isinstance(normal.get("top3"), list) else []
    summaries: list[str] = []
    for row in top3[:3]:
        if not isinstance(row, dict):
            continue
        tit = str(row.get("title") or "").strip()
        wh = str(row.get("what_happened") or "").strip()
        snippet = (wh[:80] if wh else tit[:80]).strip()
        if snippet:
            summaries.append(snippet)
    if not summaries:
        summaries.append("本期周报已汇总本周 AI 领域重要动态，可在站内查看完整内容。")
    for i, s in enumerate(summaries[:MAX_TOP_ITEMS], 1):
        lines.append(f"{i}. {s}")

    lines.extend(["", "查看完整周报：", weekly_main_link, "", "你收到此邮件是因为订阅了 AI Pulse。"])
    lines.append("如需取消订阅，可在账户设置中关闭邮件通知。")

    body = "\n".join(lines)
    if len(body) > MAX_EMAIL_CHARS:
        body = body[: MAX_EMAIL_CHARS - 1] + "…"

    ep = {
        "subject": subject_line,
        "preheader": "本周 AI 行业周报已更新，欢迎站内阅读全文。",
        "body_text": body,
        "body_html": "",
        "main_link": weekly_main_link,
        "unsubscribe_text": "你收到此邮件是因为订阅了 AI Pulse。如需取消订阅，可在账户设置中关闭邮件通知。",
        "risk_score": 100,
        "risk_notes": [],
    }
    return merge_email_payload_defaults(ep, weekly_main_link=weekly_main_link)


def render_notification_email(
    ep: dict[str, Any],
    *,
    recipient_email: str | None = None,
) -> tuple[str, str, str]:
    """
    返回 (subject, html_body, text_body)。
    不包含订阅页脚（仍由 append_subscription_footer / 发送层拼接退订链接）。
    """
    ep = merge_email_payload_defaults(ep, weekly_main_link=str(ep.get("main_link") or ""))
    subject = str(ep.get("subject") or "[AI Pulse] 本周 AI 行业观察已更新").strip()
    pre = str(ep.get("preheader") or "").strip()
    body_txt = str(ep.get("body_text") or "").strip()
    u_txt = str(ep.get("unsubscribe_text") or "").strip()

    inner_html = str(ep.get("body_html") or "").strip()
    if not inner_html:
        inner_html = build_notification_body_html(body_txt, str(ep.get("main_link") or ""))

    parts_html: list[str] = []
    if pre:
        parts_html.append(f'<div style="display:none;max-height:0;overflow:hidden">{html.escape(pre)}</div>')
    if recipient_email:
        parts_html.append(
            f'<p style="color:#666;font-size:13px">本邮件发送至：<b>{html.escape(recipient_email)}</b></p>'
        )
    parts_html.append(inner_html)

    parts_txt: list[str] = []
    if recipient_email:
        parts_txt.append(f"本邮件发送至：{recipient_email}")
    parts_txt.append(body_txt)
    if u_txt:
        parts_txt.append(u_txt)

    html_body = (
        "<html><body style='font-family:system-ui,sans-serif;max-width:640px'>"
        + "\n".join(parts_html)
        + "</body></html>"
    )
    text_body = "\n\n".join(parts_txt)
    return subject, html_body, text_body


def is_email_payload_sendable(ep: dict[str, Any] | None, *, settings: Settings | None = None) -> bool:
    if not isinstance(ep, dict) or not ep:
        return False
    return len(validate_email_payload(ep, settings=settings)) == 0


def try_render_stored_notification(
    payload_raw: str,
    *,
    recipient_email: str | None,
    settings: Settings | None = None,
) -> tuple[str, str, str] | None:
    """
    若存储的 payload 含可用 email_payload，返回 (subject, html_body, text_body)；否则 None。
    第一阶段：仅通过 validate_email_payload 时才发信。
    """
    s = settings or get_settings()
    _, ep = parse_stored_payload(payload_raw or "{}")
    if ep is None or not is_email_payload_sendable(ep, settings=s):
        return None
    ml = str(ep.get("main_link") or "").strip()
    if not ml:
        return None
    ep = merge_email_payload_defaults(dict(ep), weekly_main_link=ml)
    if not is_email_payload_sendable(ep, settings=s):
        return None
    return render_notification_email(ep, recipient_email=recipient_email)


def parse_stored_payload(raw: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """从周刊存储 JSON 拆出 PRD 与 email_payload（不丢弃扩展字段）。"""
    try:
        d = json.loads(raw or "{}")
    except json.JSONDecodeError:
        d = {}
    if not isinstance(d, dict):
        return {}, None
    ep = d.get("email_payload")
    email_payload = ep if isinstance(ep, dict) else None
    prd = {k: v for k, v in d.items() if k != "email_payload"}
    return prd, email_payload
