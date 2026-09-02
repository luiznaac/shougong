from __future__ import annotations

import pytest

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.srs.model import SrsRating
from shougong.usecase.study.service import StudyService
from shougong.usecase.study_item_history.service import StudyItemHistoryService
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeStudyItemRepository,
    FakeTransactionTemplate,
    StubSrsEngine,
    make_dictionary_entry,
    make_srs_card,
)

_NOW = make_srs_card().due  # 2026-01-01T00:00:00Z


def _services(*, entries: tuple[int, ...] = (1,)) -> tuple[StudyService, StudyItemHistoryService]:
    tx = FakeTransactionTemplate()
    study_repo = FakeStudyItemRepository()
    dictionary = FakeDictionaryRepository([make_dictionary_entry(entry_id=n) for n in entries])
    study = StudyService(study_repo, dictionary, StubSrsEngine(), FixedClock(_NOW), tx)
    history = StudyItemHistoryService(study_repo.history, study_repo, tx)
    return study, history


async def test_add_item_writes_a_creation_history_row() -> None:
    study, history = _services()

    item = await study.add_item(1)

    (row,) = await history.item_history(item.id)
    assert row.study_item_id == item.id
    assert row.entry == item.entry
    assert row.card == item.card
    assert row.created_at == _NOW  # when the history row was written


async def test_review_appends_a_history_row_for_the_updated_item() -> None:
    study, history = _services()
    item = await study.add_item(1)

    result = await study.review_item(item.id, SrsRating.GOOD)

    after_review, creation = await history.item_history(item.id)  # newest first
    assert creation.card == item.card
    assert after_review.card == result.item.card  # the state the review produced
    assert after_review.created_at == _NOW  # the review time


async def test_item_history_lists_rows_newest_first() -> None:
    study, history = _services()
    item = await study.add_item(1)
    result = await study.review_item(item.id, SrsRating.GOOD)

    rows = await history.item_history(item.id)

    assert [row.card for row in rows] == [result.item.card, item.card]
    assert {row.study_item_id for row in rows} == {item.id}


async def test_item_history_unknown_raises_not_found() -> None:
    _, history = _services()

    with pytest.raises(ResourceNotFoundError):
        await history.item_history(999)


async def test_learning_to_review_transitions_returns_the_graduation_row_per_item() -> None:
    study, history = _services(entries=(1, 2))
    graduated = await study.add_item(1)
    still_learning = await study.add_item(2)

    result = await study.review_item(graduated.id, SrsRating.GOOD)

    (transition,) = await history.learning_to_review_transitions()
    assert transition.study_item_id == graduated.id
    assert transition.card == result.item.card  # the REVIEW state the review produced
    assert still_learning.id not in {row.study_item_id for row in await history.learning_to_review_transitions()}


async def test_learning_to_review_transitions_is_paginated_newest_first() -> None:
    study, history = _services(entries=(1, 2, 3))
    ids = []
    for entry_id in (1, 2, 3):
        item = await study.add_item(entry_id)
        await study.review_item(item.id, SrsRating.GOOD)
        ids.append(item.id)

    page = await history.learning_to_review_transitions(limit=2, offset=0)
    rest = await history.learning_to_review_transitions(limit=2, offset=2)

    assert [row.study_item_id for row in page] == [ids[2], ids[1]]  # newest first
    assert [row.study_item_id for row in rest] == [ids[0]]


async def test_learning_to_review_transitions_empty_when_nothing_graduated() -> None:
    study, history = _services()
    await study.add_item(1)

    assert await history.learning_to_review_transitions() == []
