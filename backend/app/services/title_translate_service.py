"""
英文 canonical_title → 中文 title_zh，写入 GlobalEvent 时触发。
未配置 LLM_API_* / DOUBAO_* 或调用失败时保留空字符串，前端仍走原有兜底。
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any

import httpx

from app.config import get_settings
from app.models import GlobalEvent

_log = logging.getLogger("uvicorn.error")

_CJK_RE = re.compile(r"[\u4e00-\u9fff]")


def _has_cjk(s: str) -> bool:
    return bool(_CJK_RE.search(s or ""))


def _sha256_hex(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


def _metrics_obj(ge: GlobalEvent) -> dict[str, Any]:
    try:
        m = json.loads(ge.metrics_json or "{}")
        return m if isinstance(m, dict) else {}
    except json.JSONDecodeError:
        return {}


def _set_metrics(ge: GlobalEvent, patch: dict[str, Any]) -> None:
    m = _metrics_obj(ge)
    m.update(patch)
    ge.metrics_json = json.dumps(m, ensure_ascii=False)


def _get_cached_title_source_hash(ge: GlobalEvent) -> str | None:
    m = _metrics_obj(ge)
    v = m.get("title_zh_source_sha256")
    return str(v).strip() if isinstance(v, str) else None


def translate_canonical_title_en_to_zh(title_en: str, *, timeout_s: float = 45.0) -> str:
    """调用 LLM API 将英文标题译为简洁中文（单行）。"""
    settings = get_settings()
    if not settings.effective_llm_api_key or not settings.effective_llm_model:
        raise RuntimeError("LLM not configured")

    t = (title_en or "").strip()
    if not t:
        return ""

    url = f"{settings.effective_llm_api_base.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.effective_llm_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是科技新闻标题翻译助手。只输出译文本身，不要解释、不要引号、不要前缀。"
                    "将英文标题译为简短自然的中文标题（一般不超过 40 个字）。"
                ),
            },
            {
                "role": "user",
                "content": f"请翻译下列英文标题为中文：\n{t}",
            },
        ],
        "temperature": 0.2,
        "max_tokens": 256,
    }
    if "api.deepseek.com" in settings.effective_llm_api_base.lower():
        # DeepSeek V4 enables high-effort thinking by default. For a short title
        # translation that can consume the entire output budget and leave the
        # final `content` empty, so force the deterministic non-thinking path.
        payload["thinking"] = {"type": "disabled"}
    headers = {
        "Authorization": f"Bearer {settings.effective_llm_api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=timeout_s) as client:
        r = client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
    content = data["choices"][0]["message"]["content"]
    out = (content or "").strip()
    out = out.strip('"').strip("'").strip()
    out = re.sub(r"^中文标题[：:]\s*", "", out)
    return out[:512]


def ensure_global_event_title_zh(ge: GlobalEvent) -> None:
    """
    根据 canonical_title 填充 title_zh：
    - 已含中文：title_zh = canonical_title（整段），并记录 hash；
    - 纯英文：LLM API 翻译；未配置或失败则不改写已有合理缓存，失败时 title_zh 可为空。
    - 通过 metrics_json.title_zh_source_sha256 避免同源标题重复调用 API。
    """
    ct = (ge.canonical_title or "").strip()
    if not ct:
        ge.title_zh = ""
        return

    src_hash = _sha256_hex(ct)

    if _has_cjk(ct):
        ge.title_zh = ct[:512]
        _set_metrics(ge, {"title_zh_source_sha256": src_hash})
        return

    cached = _get_cached_title_source_hash(ge)
    if cached == src_hash and (ge.title_zh or "").strip():
        return

    settings = get_settings()
    if not settings.effective_llm_api_key or not settings.effective_llm_model:
        _log.debug("title_zh skip: LLM_API_KEY / LLM_MODEL or DOUBAO_* not set")
        return

    try:
        zh = translate_canonical_title_en_to_zh(ct)
        if zh and _has_cjk(zh):
            ge.title_zh = zh[:512]
            _set_metrics(ge, {"title_zh_source_sha256": src_hash})
        else:
            _log.warning("title_zh: model returned empty or non-CJK for event id=%s", ge.id)
    except Exception as exc:
        _log.warning("title_zh translate failed id=%s: %s", ge.id, exc)
