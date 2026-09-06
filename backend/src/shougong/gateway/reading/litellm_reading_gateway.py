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
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import httpx

from shougong.usecase.reading.gateway import IReadingTextGateway, ReadingDraft, RejectedDraft
from shougong.usecase.reading.model import ReadingFormat, ReadingGenerationError
from shougong.usecase.reading.working_set import WorkingSet

_TOOL_NAME = "return_reading_text"

# Generous ceiling so a runaway response can't rack up cost — the correction
# loop can call the model several times per request. Sized well above any
# reasonable reading text so it never truncates legitimate output.
_MAX_OUTPUT_TOKENS = 1200

_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": _TOOL_NAME,
        "description": "Returns the generated Mandarin reading text.",
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The complete Mandarin text (hanzi), with no pinyin or translation mixed in.",
                },
            },
            "required": ["text"],
            "additionalProperties": False,
        },
    },
}

_SYSTEM_PROMPT = Path(__file__).with_name("system_prompt.txt").read_text(encoding="utf-8").strip()


def _revision_instruction(rejected_words: Sequence[str], max_extra_words: int) -> str:
    return (
        f"These words are not in known_words: {', '.join(rejected_words)}. "
        "Rewrite the whole text so none of them appear. Keep the meaning and the "
        "narrative arc — rewrite sentences, don't drop them. "
        f"You may keep at most {max_extra_words} of them."
    )


def _build_messages(
    *,
    working_set: WorkingSet,
    text_format: ReadingFormat,
    max_extra_words: int,
    topic: str | None,
    prior_attempts: Sequence[RejectedDraft],
) -> list[dict[str, str]]:
    user_payload: dict[str, Any] = {
        "known_words": {group: list(words) for group, words in working_set.groups.items()},
        "must_use": list(working_set.must_use),
        "format": text_format.value,
        "max_extra_words": max_extra_words,
        "topic": topic or "free choice, something everyday",
    }
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": "Generate a reading text with these parameters (as JSON):\n"
            + json.dumps(user_payload, ensure_ascii=False),
        },
    ]
    for attempt in prior_attempts:
        messages.append({"role": "assistant", "content": attempt.draft})
        messages.append({"role": "user", "content": _revision_instruction(attempt.rejected_words, max_extra_words)})
    return messages


class LiteLlmReadingGateway(IReadingTextGateway):
    def __init__(self, client: httpx.AsyncClient, base_url: str, api_key: str) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"} if self._api_key else {}

    async def list_models(self) -> tuple[str, ...]:
        try:
            response = await self._client.get(f"{self._base_url}/models", headers=self._headers)
            response.raise_for_status()
            body = response.json()
            return tuple(sorted(str(entry["id"]) for entry in body["data"]))
        except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise ReadingGenerationError(f"ai gateway request failed: {exc}") from exc

    async def generate(
        self,
        *,
        working_set: WorkingSet,
        text_format: ReadingFormat,
        max_extra_words: int,
        model: str,
        topic: str | None,
        prior_attempts: Sequence[RejectedDraft] = (),
    ) -> ReadingDraft:
        payload: dict[str, Any] = {
            "model": model,
            "messages": _build_messages(
                working_set=working_set,
                text_format=text_format,
                max_extra_words=max_extra_words,
                topic=topic,
                prior_attempts=prior_attempts,
            ),
            "tools": [_TOOL_SCHEMA],
            "tool_choice": {"type": "function", "function": {"name": _TOOL_NAME}},
            "max_tokens": _MAX_OUTPUT_TOKENS,
        }

        try:
            response = await self._client.post(
                f"{self._base_url}/chat/completions", json=payload, headers=self._headers
            )
            response.raise_for_status()
            body = response.json()
            arguments = json.loads(body["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"])
            usage = body.get("usage") or {}
            return ReadingDraft(
                text=str(arguments["text"]),
                prompt_tokens=int(usage.get("prompt_tokens", 0)),
                completion_tokens=int(usage.get("completion_tokens", 0)),
            )
        except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise ReadingGenerationError(f"ai gateway request failed: {exc}") from exc
