from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.config import get_settings


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

    def complete_json(self, *, system: str, user: str, temperature: float = 0.2, timeout_s: float = 120.0) -> dict[str, Any]:
        if not self.is_configured():
            raise RuntimeError("LLM not configured: set DOUBAO_API_KEY and DOUBAO_MODEL.")

        url = f"{self.settings.doubao_api_base.rstrip('/')}/chat/completions"
        payload = {
            "model": self.settings.doubao_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": float(temperature),
        }
        headers = {
            "Authorization": f"Bearer {self.settings.doubao_api_key}",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=timeout_s) as client:
            r = client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            data = r.json()

        content = data["choices"][0]["message"]["content"]
        return _extract_json_block(content)

