from __future__ import annotations

import pytest

from shougong.usecase.commons.exceptions import ConflictError, ResourceNotFoundError
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.study.service import StudyService
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeStudyItemRepository,
    FakeTransactionTemplate,
    StubSrsScheduler,
    make_dictionary_entry,
    make_srs_card,
    make_study_item,
)

_NOW = make_srs_card().due  # 2026-01-01T00:00:00Z


def _service(
    *,
    dictionary: FakeDictionaryRepository | None = None,
    study: FakeStudyItemRepository | None = None,
) -> StudyService:
    return StudyService(
        study or FakeStudyItemRepository(),
        dictionary or FakeDictionaryRepository([make_dictionary_entry(entry_id=1)]),
        StubSrsScheduler(),
        FixedClock(_NOW),
        FakeTransactionTemplate(),
    )


async def test_add_item_creates_a_card_due_now() -> None:
    study = FakeStudyItemRepository()
    service = _service(study=study)

    item = await service.add_item(1)

    assert item.entry.id == 1
    assert item.card.due == _NOW
    assert len(study.items) == 1


async def test_add_item_unknown_entry_raises_not_found() -> None:
    service = _service(dictionary=FakeDictionaryRepository())

    with pytest.raises(ResourceNotFoundError):
        await service.add_item(999)


async def test_add_item_rejects_a_duplicate() -> None:
    study = FakeStudyItemRepository([make_study_item(entry=make_dictionary_entry(entry_id=1))])
    service = _service(study=study)

    with pytest.raises(ConflictError):
        await service.add_item(1)


async def test_list_items_due_only_filters_by_the_clock() -> None:
    soon = make_study_item(item_id=1, card=make_srs_card(due=_NOW))
    later = make_study_item(item_id=2, card=make_srs_card(due=_NOW.replace(year=2027)))
    service = _service(study=FakeStudyItemRepository([soon, later]))

    due = await service.list_items(due_only=True)
    all_items = await service.list_items(due_only=False)

    assert [i.id for i in due] == [1]
    assert [i.id for i in all_items] == [1, 2]


async def test_get_item_missing_raises_not_found() -> None:
    service = _service()

    with pytest.raises(ResourceNotFoundError):
        await service.get_item(123)
