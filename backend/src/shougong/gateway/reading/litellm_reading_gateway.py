"""`LiteLlmReadingGateway` — implements `IReadingTextGateway` against a
self-hosted LiteLLM proxy (OpenAI-compatible `/chat/completions`).

Structured output is forced via tool calling instead of a "respond in JSON"
instruction: the model is required to call `return_reading_text` (a `text`
property, plus a `lines` turn breakdown for dialogue) — no overall translation
is ever requested or returned.

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

from shougong.usecase.reading.gateway import DialogueLine, IReadingTextGateway, ReadingDraft, RejectedDraft
from shougong.usecase.reading.model import ReadingFormat, ReadingGenerationError
from shougong.usecase.reading.proficiency import BudgetAudience
from shougong.usecase.reading.working_set import WorkingSet

_TOOL_NAME = "return_reading_text"

# Fills {BUDGET_POLICY} in the system prompt — a learner who already has the
# function words of their level should spend the extra-word budget on content
# (spec §3.5); one who doesn't should spend it on the missing particles.
_BUDGET_POLICY: dict[BudgetAudience, str] = {
    BudgetAudience.INTERMEDIATE: (
        "Spend the extra budget on ONE concrete, interesting content word that makes the "
        "text worth reading — not on connectives or filler. If you are at the limit, "
        "rewrite with known_words; never exceed the ceiling."
    ),
    BudgetAudience.BEGINNER: (
        "Spend the extra budget on the grammatical particles the text cannot work without. "
        "If you are at the limit, rewrite with known_words; never exceed the ceiling."
    ),
}

# Defaults for the constructor below — the container passes the configured
# values (GATEWAYS__AI__MAX_OUTPUT_TOKENS / GATEWAYS__AI__REASONING_EFFORT).
#
# Generous ceiling so a runaway response can't rack up cost — the correction
# loop can call the model several times per request. Reasoning models count
# their reasoning tokens against this budget: a dialogue request was observed
# spending ~12k before it emitted the tool call, so a small ceiling truncates
# the response mid-thought and no tool call ever arrives.
_MAX_OUTPUT_TOKENS = 16000

# The proxy's models reason by default (chain-of-thought, counted against
# max_tokens above). "low" keeps enough reasoning to hold the vocabulary
# ceiling — it measurably reduced out-of-vocabulary words versus disabling
# reasoning — while leaving room to finish well inside the ceiling. "none"
# was cheaper but converged more slowly in the correction loop; the default
# effort used the whole budget and truncated.
_REASONING_EFFORT = "low"

# A non-streaming `/chat/completions` call only returns once the whole text is
# generated, and a reasoning model routinely needs longer than the shared
# client's 10s read timeout. Live requests at "low" effort spent 5k-13k tokens
# reasoning and took 86-246s, so this leaves headroom over the slowest observed
# attempt. It covers one attempt; the correction loop makes several.
_GENERATION_TIMEOUT_SECONDS = 300.0
_CONNECT_TIMEOUT_SECONDS = 5.0

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
                    "description": (
                        "The complete Mandarin text (hanzi), with no pinyin or translation mixed in. "
                        "For dialogue, the running text of every turn joined together."
                    ),
                },
                "lines": {
                    "type": "array",
                    "description": ("Required for dialogue: one entry per turn, in order. Omit for other formats."),
                    "items": {
                        "type": "object",
                        "properties": {
                            "speaker": {
                                "type": "string",
                                "description": "Exactly one of the provided speakers — never invented.",
                            },
                            "text": {
                                "type": "string",
                                "description": "The utterance only — no quotation marks, no 'X说'.",
                            },
                        },
                        "required": ["speaker", "text"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["text"],
            "additionalProperties": False,
        },
    },
}

_SYSTEM_PROMPT = Path(__file__).with_name("system_prompt.txt").read_text(encoding="utf-8").strip()


def _revision_instruction(attempt: RejectedDraft, max_extra_words: int) -> str:
    parts: list[str] = []
    if attempt.rejected_words:
        parts.append(
            f"These words are not in known_words: {', '.join(attempt.rejected_words)}. "
            "Rewrite the whole text so none of them appear. Keep the meaning and the "
            "narrative arc — rewrite sentences, don't drop them. "
            f"You may keep at most {max_extra_words} of them."
        )
    if attempt.problems:
        parts.append("Also fix: " + "; ".join(attempt.problems))
    return " ".join(parts) or "Revise the text."


def _build_messages(
    *,
    working_set: WorkingSet,
    text_format: ReadingFormat,
    max_extra_words: int,
    topic: str | None,
    budget_audience: BudgetAudience,
    avoid_openings: Sequence[str],
    speakers: Sequence[str],
    prior_attempts: Sequence[RejectedDraft],
) -> list[dict[str, str]]:
    user_payload: dict[str, Any] = {
        "known_words": {group: list(words) for group, words in working_set.groups.items()},
        "must_use": list(working_set.must_use),
        "format": text_format.value,
        "max_extra_words": max_extra_words,
        "topic": topic or "free choice, something everyday",
        "avoid_openings": list(avoid_openings),
    }
    if text_format is ReadingFormat.DIALOGUE:
        user_payload["speakers"] = list(speakers)
    system_prompt = _SYSTEM_PROMPT.replace("{BUDGET_POLICY}", _BUDGET_POLICY[budget_audience])
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": "Generate a reading text with these parameters (as JSON):\n"
            + json.dumps(user_payload, ensure_ascii=False),
        },
    ]
    for attempt in prior_attempts:
        messages.append({"role": "assistant", "content": attempt.draft})
        messages.append({"role": "user", "content": _revision_instruction(attempt, max_extra_words)})
    return messages


def _describe_error(exc: Exception) -> str:
    """`httpcore` raises several exceptions (`ReadTimeout`, `ReadError`, …) with an
    empty message, so `str(exc)` alone leaves the domain error ending in ': '."""
    return f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__


class LiteLlmReadingGateway(IReadingTextGateway):
    def __init__(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        api_key: str,
        *,
        reasoning_effort: str = _REASONING_EFFORT,
        max_output_tokens: int = _MAX_OUTPUT_TOKENS,
        generation_timeout: float = _GENERATION_TIMEOUT_SECONDS,
    ) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._reasoning_effort = reasoning_effort
        self._max_output_tokens = max_output_tokens
        self._generation_timeout = generation_timeout

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
            raise ReadingGenerationError(f"ai gateway request failed: {_describe_error(exc)}") from exc

    async def generate(
        self,
        *,
        working_set: WorkingSet,
        text_format: ReadingFormat,
        max_extra_words: int,
        model: str,
        topic: str | None,
        budget_audience: BudgetAudience,
        avoid_openings: Sequence[str] = (),
        speakers: Sequence[str] = (),
        prior_attempts: Sequence[RejectedDraft] = (),
    ) -> ReadingDraft:
        payload: dict[str, Any] = {
            "model": model,
            "messages": _build_messages(
                working_set=working_set,
                text_format=text_format,
                max_extra_words=max_extra_words,
                topic=topic,
                budget_audience=budget_audience,
                avoid_openings=avoid_openings,
                speakers=speakers,
                prior_attempts=prior_attempts,
            ),
            "tools": [_TOOL_SCHEMA],
            "tool_choice": {"type": "function", "function": {"name": _TOOL_NAME}},
            "max_tokens": self._max_output_tokens,
            "reasoning_effort": self._reasoning_effort,
        }

        try:
            response = await self._client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=self._headers,
                timeout=httpx.Timeout(self._generation_timeout, connect=_CONNECT_TIMEOUT_SECONDS),
            )
            response.raise_for_status()
            body = response.json()
            choices = body.get("choices") or []
            message = choices[0].get("message") or {} if choices else {}
            tool_calls = message.get("tool_calls") or []
            if not tool_calls:
                finish_reason = choices[0].get("finish_reason") if choices else None
                raise ReadingGenerationError(
                    f"ai gateway returned no tool call (finish_reason={finish_reason!r}) — "
                    "the model likely spent the whole output budget reasoning before calling the tool"
                )
            try:
                arguments = json.loads(tool_calls[0]["function"]["arguments"])
            except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
                raise ReadingGenerationError(
                    "ai gateway returned a malformed tool call — the response was likely truncated"
                ) from exc
            usage = body.get("usage") or {}
            lines = _parse_lines(arguments.get("lines"))
            # `text` is required by the schema, but models frequently omit it for
            # dialogue and just fill `lines` — rebuild the running text from the
            # turns rather than failing the whole generation.
            text = str(arguments.get("text") or "").strip() or "".join(line.text for line in lines)
            if not text:
                raise ReadingGenerationError("ai gateway returned an empty reading text")
            return ReadingDraft(
                text=text,
                prompt_tokens=int(usage.get("prompt_tokens", 0)),
                completion_tokens=int(usage.get("completion_tokens", 0)),
                lines=lines,
            )
        except (httpx.HTTPError, KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise ReadingGenerationError(f"ai gateway request failed: {_describe_error(exc)}") from exc


def _parse_lines(raw: Any) -> tuple[DialogueLine, ...]:
    if not isinstance(raw, list):
        return ()
    lines: list[DialogueLine] = []
    for entry in raw:
        if isinstance(entry, dict) and entry.get("speaker") and entry.get("text"):
            lines.append(DialogueLine(speaker=str(entry["speaker"]), text=str(entry["text"])))
    return tuple(lines)
