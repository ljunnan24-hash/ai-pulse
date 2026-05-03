"""
邮件送达率：在结构化 payload（PRD v3）进入 finalize 之前做 URL 清洗 + LLM 审核与改写。

命名对齐产品侧：Email Deliverability Auditor + Rewriter（非「改写 Agent」简称）。
"""

from __future__ import annotations

import copy
import json
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.services.digest_builder import render_issue_email
from app.services.llm_json_client import LlmJsonClient
from app.services.payload_schema import ensure_payload_v3

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


def run_deliverability_auditor(
    llm: LlmJsonClient,
    *,
    payload: dict[str, Any] | None = None,
    html_body: str | None = None,
    text_body: str | None = None,
    link_count: int = 0,
    shortlink_hosts: list[str] | None = None,
) -> dict[str, Any]:
    shortlink_hosts = shortlink_hosts or []
    hint = (
        f"结构化字段中约有 {link_count} 个 http(s) 链接计数（用于参考）。\n"
        f"可能的短链域名：{shortlink_hosts or ['无']}\n"
    )
    json_tail = (
        "\n\n只输出 JSON：\n"
        "{\n"
        '  "deliverability_score": 0-100,\n'
        '  "risk_level": "low|medium|high",\n'
        '  "risk_reasons": [],\n'
        '  "rewrite_required": true/false,\n'
        '  "rewrite_instructions": [],\n'
        '  "subject_suggestions": [],\n'
        '  "content_issues": [],\n'
        '  "link_issues": []\n'
        "}\n"
        "评分标准：>=85 可发送；70-84 建议改写；<70 必须改写。\n"
    )
    if html_body is not None and text_body is not None:
        user = (
            "你是 Email Deliverability Auditor：下列为「渲染后的」周报邮件 HTML 与纯文本（节选），"
            "审核是否可能触发 ESP 内容反垃圾（如阿里云直邮 554）。\n\n"
            "检查：营销/夸张/诱导点击/高收益承诺；语气是否偏信息服务而非广告；链接观感是否过度推销。\n"
            "（退订入口、multipart 由发送层保证。）\n\n"
            + hint
            + "\n--- HTML（节选） ---\n"
            + (html_body[:16000])
            + "\n--- TEXT（节选） ---\n"
            + (text_body[:12000])
            + json_tail
        )
    elif payload is not None:
        user = (
            "你是 Email Deliverability Auditor，审核 AI Pulse 周报结构化 JSON（PRD v3）是否可能触发"
            "ESP 内容反垃圾（如阿里云直邮 554 content spam）。\n\n"
            "检查：营销/夸张/诱导点击/高收益承诺类措辞；链接是否过多或疑似短链、跳转；"
            "模板化夸张标题；事实型信息服务语气是否足够。\n\n"
            + hint
            + "\npayload JSON：\n"
            + json.dumps(payload, ensure_ascii=False)
            + json_tail
        )
    else:
        return {}

    out = llm.complete_json(
        system="You output JSON only. You specialize in email deliverability for Chinese newsletters.",
        user=user,
        temperature=0.1,
    )
    return out if isinstance(out, dict) else {}


def _preview_email_bodies(payload: dict[str, Any]) -> tuple[str, str]:
    p = ensure_payload_v3(payload)
    return render_issue_email(p, "normal", issue_heading=None)


def run_deliverability_rewriter(
    llm: LlmJsonClient,
    *,
    payload: dict[str, Any],
    audit: dict[str, Any],
) -> dict[str, Any]:
    instr = audit.get("rewrite_instructions") if isinstance(audit.get("rewrite_instructions"), list) else []
    user = (
        "你是 Email Deliverability Rewriter：将周报 payload 改为中性信息服务语气，降低营销感与垃圾邮件特征。\n"
        "规则：保留事实与事件含义；不编造；每条事件保留至多一个主链接（url 字段）；"
        "弱化或删除：免费、限时领取、暴富、稳赚、内部消息、独家渠道、秒杀、震撼、颠覆、最强等高风险营销词；"
        "删除夸张诱导点击句；不把正文改成广告口吻。\n\n"
        "上轮审核 JSON：\n"
        f"{json.dumps(audit, ensure_ascii=False)}\n\n"
        "待改写 payload（须输出同结构 PRD v3）：\n"
        f"{json.dumps(payload, ensure_ascii=False)}\n\n"
        "只输出 JSON：\n"
        "{\n"
        '  "payload": { ... 与输入同 schema 的 PRD v3 ... },\n'
        '  "changes_made": ["一句简述", ...]\n'
        "}\n"
    )
    if instr:
        user += "\n优先落实 rewrite_instructions：\n" + json.dumps(instr, ensure_ascii=False)
    out = llm.complete_json(
        system="You output JSON only. Chinese editorial rewrite; preserve schema keys.",
        user=user,
        temperature=0.2,
        timeout_s=300.0,
    )
    return out if isinstance(out, dict) else {}


def apply_deliverability_pipeline(
    llm: LlmJsonClient,
    payload: dict[str, Any],
    *,
    enabled: bool,
    rewrite_score_threshold: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    返回 (possibly_modified_payload, artifact)。
    rewrite_score_threshold：低于则触发改写（默认 85，与文档档位一致）。
    是否回退由 should_fallback_after_deliverability(..., min_score=...) 单独判断。
    """
    artifact: dict[str, Any] = {"stage": "deliverability", "skipped": True}

    if not enabled:
        return payload, artifact

    base = copy.deepcopy(payload) if isinstance(payload, dict) else {}
    sanitized = sanitize_urls_in_payload(base)
    lc = count_structured_http_links(sanitized)
    short_hosts = _shortlink_hosts_in_payload(sanitized)

    artifact = {
        "stage": "deliverability",
        "skipped": False,
        "url_tracking_stripped": True,
        "link_count": lc,
        "shortlink_hosts": short_hosts,
        "auditor_input": "rendered_email",
    }

    html_prev, text_prev = _preview_email_bodies(sanitized)
    audit1 = run_deliverability_auditor(
        llm,
        html_body=html_prev,
        text_body=text_prev,
        link_count=lc,
        shortlink_hosts=short_hosts,
    )
    artifact["audit_round1"] = audit1

    score1 = _parse_score(audit1.get("deliverability_score"))
    risk = str(audit1.get("risk_level") or "medium").lower()
    rewrite_flag = audit1.get("rewrite_required") is True
    need_rewrite = (
        rewrite_flag
        or score1 < int(rewrite_score_threshold)
        or risk == "high"
    )

    current = sanitized
    if need_rewrite:
        rw = run_deliverability_rewriter(llm, payload=current, audit=audit1)
        artifact["rewrite"] = rw
        new_p = rw.get("payload") if isinstance(rw.get("payload"), dict) else None
        if isinstance(new_p, dict) and new_p:
            current = new_p
            cur_san = sanitize_urls_in_payload(copy.deepcopy(current))
            h2, t2 = _preview_email_bodies(cur_san)
            audit2 = run_deliverability_auditor(
                llm,
                html_body=h2,
                text_body=t2,
                link_count=count_structured_http_links(cur_san),
                shortlink_hosts=_shortlink_hosts_in_payload(cur_san),
            )
            artifact["audit_round2"] = audit2
            artifact["final_deliverability_score"] = _parse_score(audit2.get("deliverability_score"))
            artifact["final_risk_level"] = str(audit2.get("risk_level") or "").lower()
        else:
            artifact["rewrite_failed_empty_payload"] = True
            artifact["final_deliverability_score"] = score1
            artifact["final_risk_level"] = risk
    else:
        artifact["final_deliverability_score"] = score1
        artifact["final_risk_level"] = risk

    return current, artifact


def should_fallback_after_deliverability(
    artifact: dict[str, Any],
    *,
    min_score: int,
) -> tuple[bool, str]:
    """编排器：是否在送达率阶段强制回退确定性组装。"""
    if artifact.get("skipped"):
        return False, ""
    if artifact.get("rewrite_failed_empty_payload"):
        return True, "deliverability rewrite returned empty payload"
    fs = artifact.get("final_deliverability_score")
    if fs is None:
        return False, ""
    score = _parse_score(fs)
    if score < int(min_score):
        return True, f"deliverability score {score} < {min_score}"
    fr = str(artifact.get("final_risk_level") or "").lower()
    if fr == "high":
        return True, "deliverability risk_level still high"
    return False, ""
