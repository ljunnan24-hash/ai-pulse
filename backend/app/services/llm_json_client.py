from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger("uvicorn.error")

_JSON_RETRY_HINT = (
    "\n\n【重要】上一次输出不是合法 JSON（可能被截断，或字符串内双引号未转义）。"
    "请只输出一个完整、可被 json.loads 解析的 JSON 对象；不要 markdown 围栏；"
    "所有字符串里的双引号必须写成 \\\"。"
)


def _extract_json_block(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    raw = (m.group(1) if m else text).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(raw[start : end + 1])
        raise


class LlmJsonClient:
    """
    Thin wrapper over Volcengine Ark (Doubao) OpenAI-compatible endpoint.
    Enforces JSON-only output.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    def is_configured(self) -> bool:
        return bool(self.settings.doubao_api_key and self.settings.doubao_model)

    def complete_json(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.2,
        timeout_s: float = 120.0,
        max_tokens: int | None = None,
        json_retries: int = 2,
    ) -> dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("LLM not configured: set DOUBAO_API_KEY and DOUBAO_MODEL.")

        url = f"{self.settings.doubao_api_base.rstrip('/')}/chat/completions"
        mt = max_tokens
        if mt is None:
            mt = int(getattr(self.settings, "doubao_max_tokens", 0) or 0)

        last_decode_error: json.JSONDecodeError | None = None
        user_round = user
        for attempt in range(max(0, int(json_retries)) + 1):
            payload: dict[str, Any] = {
                "model": self.settings.doubao_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_round},
                ],
                "temperature": float(temperature),
            }
            if mt > 0:
                payload["max_tokens"] = mt

            headers = {
                "Authorization": f"Bearer {self.settings.doubao_api_key}",
                "Content-Type": "application/json",
            }
            with httpx.Client(timeout=timeout_s) as client:
                r = client.post(url, headers=headers, json=payload)
                r.raise_for_status()
                data = r.json()

            content = data["choices"][0]["message"]["content"]
            try:
                return _extract_json_block(content)
            except json.JSONDecodeError as exc:
                last_decode_error = exc
                if attempt >= int(json_retries):
                    break
                logger.warning(
                    "LLM JSON parse failed (attempt %s/%s): %s",
                    attempt + 1,
                    int(json_retries) + 1,
                    exc,
                )
                user_round = user + _JSON_RETRY_HINT
                # 重试时略降温度，减少胡编结构
                temperature = min(float(temperature), 0.15)

        assert last_decode_error is not None
        raise last_decode_error

