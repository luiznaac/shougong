"""`LiteLlmReadingGateway` — implements `IReadingTextGateway` against a
self-hosted LiteLLM proxy (OpenAI-compatible `/chat/completions`).

Structured output is forced via tool calling instead of a "respond in JSON"
instruction: the model is required to call `return_reading_text`, which only
has a `text` property — no overall translation is ever requested or returned.

The system prompt lives in `system_prompt.txt`, next to this file, rather than
as a Python string literal — content a non-engineer might want to tune (or
that simply reads better as prose) shouldn't be buried inside request-building
logic. Plain `.txt`, not `.md`: `.dockerignore` strips `**/*.md` from the build
context (docs aren't needed in the image), and this isn't documentation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx

from shougong.usecase.reading.gateway import IReadingTextGateway
from shougong.usecase.reading.model import ReadingFormat, ReadingGenerationError

_TOOL_NAME = "return_reading_text"

_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": _TOOL_NAME,
        "description": "Retorna o texto de leitura gerado em mandarim.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "O texto completo em mandarim (hanzi), sem pinyin nem tradução misturados.",
                },
            },
            "required": ["text"],
            "additionalProperties": False,
        },
    },
}

_SYSTEM_PROMPT = Path(__file__).with_name("system_prompt.txt").read_text(encoding="utf-8").strip()


def _build_messages(
    *,
    known_words: frozenset[str],
    text_format: ReadingFormat,
    max_extra_words: int,
    topic: str | None,
) -> list[dict[str, str]]:
    user_payload: dict[str, Any] = {
        "known_words": sorted(known_words),
        "format": text_format.value,
        "max_extra_words": max_extra_words,
        "topic": topic or "livre, algo do dia a dia",
    }
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": "Gere um texto de leitura com estes parâmetros (em JSON):\n"
            + json.dumps(user_payload, ensure_ascii=False),
        },
    ]


class LiteLlmReadingGateway(IReadingTextGateway):
    def __init__(self, client: httpx.AsyncClient, base_url: str, api_key: str, model: str) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model

    async def generate(
        self,
        *,
        known_words: frozenset[str],
        text_format: ReadingFormat,
        max_extra_words: int,
        topic: str | None,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": _build_messages(
                known_words=known_words,
                text_format=text_format,
                max_extra_words=max_extra_words,
                topic=topic,
            ),
            "tools": [_TOOL_SCHEMA],
            "tool_choice": {"type": "function", "function": {"name": _TOOL_NAME}},
        }
        headers = {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}

        try:
            response = await self._client.post(f"{self._base_url}/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            body = response.json()
            arguments = json.loads(body["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"])
            return str(arguments["text"])
        except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise ReadingGenerationError(f"ai gateway request failed: {exc}") from exc
