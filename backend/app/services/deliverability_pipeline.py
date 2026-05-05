"""
邮件通知层：Email Packager → Email Risk Auditor → Email Rewriter（必要时），
生成独立的 email_payload，不再改写完整 PRD 周报 JSON。
"""

from __future__ import annotations

import copy
import json
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.config import get_settings
from app.services.email_notification import (
    deterministic_email_payload,
    merge_email_payload_defaults,
    validate_email_payload,
)
from app.services.llm_json_client import LlmJsonClient

# 常见 tracking / 推广参数（去掉不改变原文指向的站点路径）
_TRACKING_QUERY_KEYS: frozenset[str] = frozenset(
    {
        "ref",
        "referrer",
        "source",
        "fbclid",
        "gclid",
        "mc_cid",
        "mc_eid",
        "spm",
        "share_token",
    }
)

_SHORTLINK_ROOTS: frozenset[str] = frozenset(
    {
        "bit.ly",
        "t.co",
        "tinyurl.com",
        "goo.gl",
        "ow.ly",
        "is.gd",
        "rebrand.ly",
        "lnk.to",
        "cutt.ly",
        "rb.gy",
        "short.link",
        "cli.re",
        "s.id",
    }
)


def _host_is_shortlink(hostname: str) -> bool:
    h = (hostname or "").lower().strip()
    if h.startswith("www."):
        h = h[4:]
    if h in _SHORTLINK_ROOTS:
        return True
    return any(h.endswith("." + r) for r in _SHORTLINK_ROOTS)


def strip_tracking_params(url: str) -> str:
    if not url or not str(url).strip().startswith(("http://", "https://")):
        return url
    try:
        p = urlparse(url.strip())
        pairs: list[tuple[str, str]] = []
        for k, v in parse_qsl(p.query, keep_blank_values=True):
            kl = k.lower()
            if kl.startswith("utm_") or kl in _TRACKING_QUERY_KEYS:
                continue
            pairs.append((k, v))
        new_query = urlencode(pairs)
        return urlunparse((p.scheme, p.netloc, p.path, p.params, new_query, p.fragment))
    except Exception:
        return url


def sanitize_urls_in_payload(obj: Any) -> Any:
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            if k in ("url", "link") and isinstance(v, str):
                out[k] = strip_tracking_params(v)
            else:
                out[k] = sanitize_urls_in_payload(v)
        return out
    if isinstance(obj, list):
        return [sanitize_urls_in_payload(x) for x in obj]
    return obj


def _collect_url_fields(obj: Any, acc: list[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("url", "link") and isinstance(v, str) and v.strip().startswith(("http://", "https://")):
                acc.append(v.strip())
            else:
                _collect_url_fields(v, acc)
    elif isinstance(obj, list):
        for x in obj:
            _collect_url_fields(x, acc)


def count_structured_http_links(payload: dict[str, Any]) -> int:
    acc: list[str] = []
    _collect_url_fields(payload, acc)
    return len(acc)


def _shortlink_hosts_in_payload(payload: dict[str, Any]) -> list[str]:
    hosts: set[str] = set()
    acc: list[str] = []
    _collect_url_fields(payload, acc)
    for u in acc:
        try:
            hn = urlparse(u).hostname or ""
            if _host_is_shortlink(hn):
                hosts.add(hn.lower())
        except Exception:
            continue
    return sorted(hosts)


def _parse_score(raw: Any) -> int:
    try:
        n = int(float(raw))
        return max(0, min(100, n))
    except Exception:
        return 0


def run_email_packager(
    llm: LlmJsonClient,
    prd_payload: dict[str, Any],
    *,
    weekly_main_link: str,
) -> dict[str, Any]:
    """
    Email Packager：将 PRD 周报压缩为通知型邮件 JSON（不含 capabilities 巨型字段重复）。
    """
    slim = {
        "simple": prd_payload.get("simple"),
        "normal": {
            "top3": (prd_payload.get("normal") or {}).get("top3"),
            "sections": (prd_payload.get("normal") or {}).get("sections"),
            "tools": (prd_payload.get("normal") or {}).get("tools"),
        },
        "glossary": prd_payload.get("glossary"),
    }
    user = (
        "你是邮件投递安全与通知邮件生成专家。\n\n"
        "请根据输入的 AI 周报 payload，生成一封“通知型邮件”，不是完整周报。\n\n"
        "硬性要求：\n"
        "1. 邮件正文不超过 500 个中文字符。\n"
        "2. 只保留 3 条摘要。\n"
        "3. 删除所有外部链接（只允许下面给出的站内主链接）。\n"
        "4. 只保留 1 个站内主链接（main_link 必须与给定 URL 完全一致）。\n"
        "5. 不出现以下词：\n"
        "免费、赚钱、副业、暴利、套利、领取、福利、加微信、VX、扫码、私聊、工具机会、零成本、金融交易、量化交易。\n"
        "6. 不使用夸张营销语气。\n"
        "7. 不使用 emoji。\n"
        "8. 不重复内容。\n"
        "9. 语气必须像系统通知/订阅更新。\n"
        "10. 必须包含取消订阅说明（写在 unsubscribe_text）。\n\n"
        f"站内主链接（main_link 必须等于）：\n{weekly_main_link}\n\n"
        "周报摘要输入 JSON：\n"
        f"{json.dumps(slim, ensure_ascii=False)}\n\n"
        "只输出 JSON：\n"
        "{\n"
        '  "subject": "",\n'
        '  "preheader": "",\n'
        '  "body_text": "",\n'
        '  "main_link": "",\n'
        '  "unsubscribe_text": "",\n'
        '  "risk_notes": []\n'
        "}\n"
    )
    out = llm.complete_json(
        system=(
            "You output JSON only. You generate concise Chinese notification emails for subscribers. "
            "Never include external URLs. Never use marketing hype."
        ),
        user=user,
        temperature=0.25,
    )
    return out if isinstance(out, dict) else {}


def run_email_risk_auditor(llm: LlmJsonClient, email_payload: dict[str, Any]) -> dict[str, Any]:
    """Email Risk Auditor：对通知邮件打分（ESP 垃圾邮件风险）。"""
    preview = {
        "subject": email_payload.get("subject"),
        "preheader": email_payload.get("preheader"),
        "body_text": email_payload.get("body_text"),
        "main_link": email_payload.get("main_link"),
    }
    user = (
        "你是 Email Risk Auditor：审核下列「通知型订阅邮件」字段，判断是否可能触发 ESP 内容过滤（如 554）。\n"
        "关注：营销诱导、夸张承诺、过多链接、金融/兼职联想词、与订阅信息服务不符的语气。\n\n"
        f"{json.dumps(preview, ensure_ascii=False)}\n\n"
        "只输出 JSON：\n"
        "{\n"
        '  "deliverability_score": 0-100,\n'
        '  "risk_level": "low|medium|high",\n'
        '  "risk_reasons": [],\n'
        '  "rewrite_required": true/false,\n'
        '  "rewrite_instructions": []\n'
        "}\n"
        "评分标准：>=85 可发送；70-84 建议改写；<70 必须改写。\n"
    )
    out = llm.complete_json(
        system="You output JSON only. Chinese newsletter deliverability specialist.",
        user=user,
        temperature=0.08,
    )
    return out if isinstance(out, dict) else {}


def run_email_rewriter(
    llm: LlmJsonClient,
    *,
    email_payload: dict[str, Any],
    prd_payload: dict[str, Any],
    hard_errors: list[Any],
    audit: dict[str, Any],
) -> dict[str, Any]:
    """Email Rewriter：只改写通知邮件 JSON，不改 PRD。"""
    slim = copy.deepcopy(prd_payload)
    user = (
        "你是 Email Rewriter：只改写「通知邮件」JSON，使其符合订阅更新/系统通知语气，降低营销与垃圾邮件特征。\n"
        "禁止修改 PRD 周报 schema；只输出 email 对象字段。\n"
        "规则：\n"
        "- main_link 必须与输入 email_payload.main_link 完全一致。\n"
        "- 正文极短，外部链接数为 0。\n"
        "- 不使用所列禁用词；不使用 emoji。\n\n"
        "硬规则校验失败原因：\n"
        f"{json.dumps([str(x) for x in hard_errors], ensure_ascii=False)}\n\n"
        "Risk Auditor：\n"
        f"{json.dumps(audit, ensure_ascii=False)}\n\n"
        "当前 email_payload：\n"
        f"{json.dumps(email_payload, ensure_ascii=False)}\n\n"
        "PRD 参考（勿整体输出）：\n"
        f"{json.dumps(slim, ensure_ascii=False)[:12000]}\n\n"
        "只输出 JSON：\n"
        "{\n"
        '  "email_payload": { "subject","preheader","body_text","main_link","unsubscribe_text","risk_notes":[] }\n'
        "}\n"
    )
    if isinstance(audit.get("rewrite_instructions"), list) and audit["rewrite_instructions"]:
        user += "\n优先落实 rewrite_instructions：\n" + json.dumps(
            audit["rewrite_instructions"], ensure_ascii=False
        )
    out = llm.complete_json(
        system="You output JSON only. Revise notification email JSON only.",
        user=user,
        temperature=0.18,
    )
    if not isinstance(out, dict):
        return {}
    ep = out.get("email_payload")
    return ep if isinstance(ep, dict) else {}


def apply_email_notification_pipeline(
    llm: LlmJsonClient,
    prd_payload: dict[str, Any],
    *,
    enabled: bool,
    weekly_main_link: str,
    rewrite_score_threshold: int,
    min_score: int,
    strict: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    在已通过校验的 PRD v3 上生成 email_payload 并写回顶层键。
    总是尝试产出 email_payload（关闭 enabled 时跳过 LLM，使用确定性模板）。
    """
    settings = get_settings()
    artifact: dict[str, Any] = {"stage": "email_notification", "skipped": False}

    main_link = (weekly_main_link or "").strip() or f"{settings.weekly_public_base_url.rstrip('/')}/weekly/latest"

    base_prd = copy.deepcopy(prd_payload) if isinstance(prd_payload, dict) else {}
    prd_sanitized = sanitize_urls_in_payload(base_prd)

    subject_hint = "[AI Pulse] 本周 AI 行业观察已更新"

    if not enabled:
        ep = deterministic_email_payload(
            prd_sanitized,
            weekly_main_link=main_link,
            subject_line=subject_hint,
        )
        merged = dict(prd_sanitized)
        merged["email_payload"] = ep
        artifact["used_deterministic_fallback"] = True
        artifact["note"] = "MULTI_AGENT_ENABLE_DELIVERABILITY=false; deterministic email_payload"
        return merged, artifact

    if not llm.is_configured():
        ep = deterministic_email_payload(prd_sanitized, weekly_main_link=main_link, subject_line=subject_hint)
        merged = dict(prd_sanitized)
        merged["email_payload"] = ep
        artifact["used_deterministic_fallback"] = True
        artifact["note"] = "LLM not configured; deterministic email_payload"
        return merged, artifact

    raw_pkg = run_email_packager(llm, prd_sanitized, weekly_main_link=main_link)
    ep = merge_email_payload_defaults(
        raw_pkg if isinstance(raw_pkg, dict) else {},
        weekly_main_link=main_link,
    )
    ep["main_link"] = main_link

    artifact["packager"] = raw_pkg
    artifact["auditor_rounds"] = []
    artifact["rewriter_rounds"] = []

    max_rounds = 3
    for round_i in range(max_rounds):
        hard_errs = validate_email_payload(ep, settings=settings)
        audit = run_email_risk_auditor(llm, ep)
        score = _parse_score(audit.get("deliverability_score"))
        ep["risk_score"] = score
        risk = str(audit.get("risk_level") or "medium").lower()
        rewrite_flag = audit.get("rewrite_required") is True
        need_rewrite = (
            bool(hard_errs)
            or rewrite_flag
            or score < int(rewrite_score_threshold)
            or risk == "high"
        )

        artifact["auditor_rounds"].append(
            {
                "round": round_i + 1,
                "hard_validation_errors": [f"{e.path}: {e.message}" for e in hard_errs],
                "audit": audit,
            }
        )

        if not need_rewrite:
            artifact["final_deliverability_score"] = score
            artifact["final_risk_level"] = risk
            break

        if round_i >= max_rounds - 1:
            ep = deterministic_email_payload(
                prd_sanitized,
                weekly_main_link=main_link,
                subject_line=str(ep.get("subject") or subject_hint),
            )
            artifact["used_deterministic_fallback"] = True
            artifact["final_deliverability_score"] = 100
            artifact["final_risk_level"] = "low"
            break

        rw_ep = run_email_rewriter(
            llm,
            email_payload=ep,
            prd_payload=prd_sanitized,
            hard_errors=hard_errs,
            audit=audit,
        )
        artifact["rewriter_rounds"].append({"round": round_i + 1, "raw": rw_ep})
        if isinstance(rw_ep, dict) and rw_ep:
            ep = merge_email_payload_defaults(rw_ep, weekly_main_link=main_link)
            ep["main_link"] = main_link
        else:
            ep = deterministic_email_payload(
                prd_sanitized,
                weekly_main_link=main_link,
                subject_line=subject_hint,
            )
            artifact["used_deterministic_fallback"] = True
            break

    # 最终硬校验：严格模式下若仍失败则用确定性模板（不回退整份 PRD）
    final_hard = validate_email_payload(ep, settings=settings)
    if final_hard:
        ep = deterministic_email_payload(
            prd_sanitized,
            weekly_main_link=main_link,
            subject_line=str(ep.get("subject") or subject_hint),
        )
        artifact["used_deterministic_fallback"] = True
        artifact["final_hard_validation_fixed"] = [f"{e.path}: {e.message}" for e in final_hard]

    out = dict(prd_sanitized)
    out["email_payload"] = merge_email_payload_defaults(ep, weekly_main_link=main_link)
    if artifact.get("final_deliverability_score") is None:
        artifact["final_deliverability_score"] = _parse_score(out["email_payload"].get("risk_score"))
        artifact["final_risk_level"] = "low"

    # 保留旧字段供日志兼容
    artifact["link_count"] = count_structured_http_links(prd_sanitized)
    artifact["shortlink_hosts"] = _shortlink_hosts_in_payload(prd_sanitized)
    artifact["weekly_main_link"] = main_link
    artifact["strict"] = strict
    artifact["min_score"] = min_score
    return out, artifact


def apply_deliverability_pipeline(
    llm: LlmJsonClient,
    payload: dict[str, Any],
    *,
    enabled: bool,
    rewrite_score_threshold: int,
    weekly_main_link: str = "",
    min_score: int = 70,
    strict: bool = True,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """兼容旧签名的包装：请改用 apply_email_notification_pipeline。"""
    return apply_email_notification_pipeline(
        llm,
        payload,
        enabled=enabled,
        weekly_main_link=weekly_main_link,
        rewrite_score_threshold=rewrite_score_threshold,
        min_score=min_score,
        strict=strict,
    )


def should_fallback_after_deliverability(
    artifact: dict[str, Any],
    *,
    min_score: int,
) -> tuple[bool, str]:
    """
    邮件层内部已回退确定性模板，不再触发「整包 PRD 回退」。
    保留函数签名供旧代码编译；始终视为无需整包回退。
    """
    _ = artifact, min_score
    return False, ""
