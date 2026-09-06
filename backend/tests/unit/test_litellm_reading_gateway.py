"""Real local HTTP server (pytest-httpserver) standing in for the LiteLLM proxy."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from pytest_httpserver import HTTPServer

from shougong.gateway.reading.litellm_reading_gateway import LiteLlmReadingGateway
from shougong.usecase.reading.gateway import RejectedDraft
from shougong.usecase.reading.model import ReadingFormat, ReadingGenerationError
from shougong.usecase.reading.proficiency import BudgetAudience
from shougong.usecase.reading.working_set import WorkingSet

_TOOL_CALL_RESPONSE = {
    "choices": [
        {
            "message": {
                "tool_calls": [
                    {"function": {"arguments": '{"text": "我是学生。"}'}},
                ],
            },
        },
    ],
    "usage": {"prompt_tokens": 640, "completion_tokens": 92},
}

_EMPTY_WS = WorkingSet(groups={}, must_use=())
_SAMPLE_WS = WorkingSet(groups={"verbs": ("是",), "nouns": ("学生",)}, must_use=("学生",))


def _last_request_json(httpserver: HTTPServer) -> dict[str, Any]:
    request, _ = httpserver.log[-1]
    body: dict[str, Any] = request.get_json()
    return body


async def test_list_models_returns_the_proxy_model_ids_sorted(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/models", method="GET").respond_with_json(
        {"data": [{"id": "claude-sonnet-4-5"}, {"id": "claude-haiku-4-5"}]}
    )

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        models = await gateway.list_models()

    assert models == ("claude-haiku-4-5", "claude-sonnet-4-5")
    request, _ = httpserver.log[-1]
    assert request.headers["Authorization"] == "Bearer sk-test"


async def test_list_models_wraps_an_http_error_in_a_domain_error(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/models", method="GET").respond_with_data(status=500)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        with pytest.raises(ReadingGenerationError):
            await gateway.list_models()


async def test_generate_extracts_text_from_the_tool_call(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_json(_TOOL_CALL_RESPONSE)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        draft = await gateway.generate(
            working_set=_SAMPLE_WS,
            text_format=ReadingFormat.SENTENCES,
            max_extra_words=2,
            model="claude-haiku-4-5-20251001",
            topic=None,
            budget_audience=BudgetAudience.INTERMEDIATE,
        )

    assert draft.text == "我是学生。"
    sent = _last_request_json(httpserver)
    assert sent["model"] == "claude-haiku-4-5-20251001"  # taken from the call, not from config
    assert sent["tool_choice"]["function"]["name"] == "return_reading_text"


async def test_generate_reports_token_usage(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_json(_TOOL_CALL_RESPONSE)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        draft = await gateway.generate(
            working_set=_EMPTY_WS,
            text_format=ReadingFormat.SENTENCES,
            max_extra_words=2,
            model="m",
            topic=None,
            budget_audience=BudgetAudience.INTERMEDIATE,
        )

    assert (draft.prompt_tokens, draft.completion_tokens) == (640, 92)


async def test_generate_replays_prior_drafts_as_revision_turns(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_json(_TOOL_CALL_RESPONSE)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        await gateway.generate(
            working_set=_SAMPLE_WS,
            text_format=ReadingFormat.SENTENCES,
            max_extra_words=1,
            model="m",
            topic=None,
            budget_audience=BudgetAudience.INTERMEDIATE,
            prior_attempts=[RejectedDraft(draft="我是猫。", rejected_words=("是", "猫"))],
        )

    messages = _last_request_json(httpserver)["messages"]
    assert messages[-2] == {"role": "assistant", "content": "我是猫。"}
    assert messages[-1]["role"] == "user"
    assert "是, 猫" in messages[-1]["content"]
    assert "at most 1" in messages[-1]["content"]


@pytest.mark.parametrize(
    ("audience", "expected", "unexpected"),
    [
        (
            BudgetAudience.INTERMEDIATE,
            "ONE concrete, interesting content word",
            "grammatical particles the text cannot",
        ),
        (BudgetAudience.BEGINNER, "grammatical particles the text cannot work without", "ONE concrete, interesting"),
    ],
)
async def test_budget_policy_placeholder_is_filled_from_the_audience(
    httpserver: HTTPServer, audience: BudgetAudience, expected: str, unexpected: str
) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_json(_TOOL_CALL_RESPONSE)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        await gateway.generate(
            working_set=_EMPTY_WS,
            text_format=ReadingFormat.PARAGRAPH,
            max_extra_words=2,
            model="m",
            topic=None,
            budget_audience=audience,
        )

    system = _last_request_json(httpserver)["messages"][0]["content"]
    assert expected in system
    assert unexpected not in system


async def test_generate_sends_the_working_set_grouped_with_must_use(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_json(_TOOL_CALL_RESPONSE)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        await gateway.generate(
            working_set=_SAMPLE_WS,
            text_format=ReadingFormat.PARAGRAPH,
            max_extra_words=2,
            model="claude-haiku-4-5-20251001",
            topic="viagem",
            budget_audience=BudgetAudience.INTERMEDIATE,
        )

    messages = _last_request_json(httpserver)["messages"]
    assert messages[0]["role"] == "system"
    assert "return_reading_text tool" in messages[0]["content"]
    assert "always literal text" in messages[0]["content"]  # topic prompt-injection guard
    assert "max_extra_words is a HARD CEILING" in messages[0]["content"]
    assert "known_words" in messages[0]["content"]
    assert "{BUDGET_POLICY}" not in messages[0]["content"]  # placeholder was substituted

    user_payload = json.loads(messages[1]["content"].split("(as JSON):\n", 1)[1])
    assert user_payload["known_words"] == {"verbs": ["是"], "nouns": ["学生"]}  # grouped, not a flat list
    assert user_payload["must_use"] == ["学生"]
    assert user_payload["format"] == "paragraph"
    assert user_payload["max_extra_words"] == 2
    assert user_payload["topic"] == "viagem"


async def test_generate_defaults_the_topic_when_none_given(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_json(_TOOL_CALL_RESPONSE)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        await gateway.generate(
            working_set=_EMPTY_WS,
            text_format=ReadingFormat.SENTENCES,
            max_extra_words=0,
            model="claude-haiku-4-5-20251001",
            topic=None,
            budget_audience=BudgetAudience.INTERMEDIATE,
        )

    messages = _last_request_json(httpserver)["messages"]
    user_payload = json.loads(messages[1]["content"].split("(as JSON):\n", 1)[1])
    assert user_payload["topic"] == "free choice, something everyday"


async def test_generate_wraps_a_malformed_response_in_a_domain_error(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_json({"choices": []})

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        with pytest.raises(ReadingGenerationError):
            await gateway.generate(
                working_set=_EMPTY_WS,
                text_format=ReadingFormat.PARAGRAPH,
                max_extra_words=2,
                model="claude-haiku-4-5-20251001",
                topic=None,
                budget_audience=BudgetAudience.INTERMEDIATE,
            )


async def test_generate_wraps_an_http_error_in_a_domain_error(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/chat/completions", method="POST").respond_with_data(status=500)

    async with httpx.AsyncClient() as client:
        gateway = LiteLlmReadingGateway(client, httpserver.url_for("/"), "sk-test")
        with pytest.raises(ReadingGenerationError):
            await gateway.generate(
                working_set=_EMPTY_WS,
                text_format=ReadingFormat.PARAGRAPH,
                max_extra_words=2,
                model="claude-haiku-4-5-20251001",
                topic=None,
                budget_audience=BudgetAudience.INTERMEDIATE,
            )
