from __future__ import annotations

from types import SimpleNamespace

from app.services import llm_json_client, title_translate_service


class _FakeResponse:
    def __init__(self, body: dict) -> None:
        self._body = body

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._body


def _patch_http_client(monkeypatch, module, captured: list[dict], body: dict) -> None:
    class _FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args) -> None:
            return None

        def post(self, url: str, *, headers: dict, json: dict):
            captured.append(json)
            return _FakeResponse(body)

    monkeypatch.setattr(module.httpx, "Client", _FakeClient)


def _deepseek_settings() -> SimpleNamespace:
    return SimpleNamespace(
        effective_llm_api_key="test-key",
        effective_llm_api_base="https://api.deepseek.com",
        effective_llm_model="deepseek-v4-flash",
        effective_llm_max_tokens=0,
    )


def test_deepseek_title_translation_disables_thinking(monkeypatch) -> None:
    monkeypatch.setattr(title_translate_service, "get_settings", _deepseek_settings)
    captured: list[dict] = []
    _patch_http_client(
        monkeypatch,
        title_translate_service,
        captured,
        {"choices": [{"message": {"content": "用于构建智能体的新工具"}}]},
    )

    result = title_translate_service.translate_canonical_title_en_to_zh("A new tool for building agents")

    assert result == "用于构建智能体的新工具"
    assert captured[0]["thinking"] == {"type": "disabled"}


def test_deepseek_json_client_uses_non_thinking_json_mode(monkeypatch) -> None:
    monkeypatch.setattr(llm_json_client, "get_settings", _deepseek_settings)
    captured: list[dict] = []
    _patch_http_client(
        monkeypatch,
        llm_json_client,
        captured,
        {"choices": [{"message": {"content": '{"ok": true}'}}]},
    )
    client = llm_json_client.LlmJsonClient()

    result = client.complete_json(system="Return JSON.", user="Test", json_retries=0)

    assert result == {"ok": True}
    assert captured[0]["thinking"] == {"type": "disabled"}
    assert captured[0]["response_format"] == {"type": "json_object"}
