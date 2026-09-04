from __future__ import annotations

import pytest

from shougong.usecase.commons.exceptions import ConflictError, ResourceNotFoundError
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsRating, SrsReviewLog
from shougong.usecase.study.model import BatchImportRow, BatchRowStatus
from shougong.usecase.study.service import StudyService
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeStudyItemRepository,
    FakeTransactionTemplate,
    StubSrsEngine,
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
        StubSrsEngine(),
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


async def test_review_item_reschedules_the_card_and_logs_the_grade() -> None:
    study = FakeStudyItemRepository([make_study_item(item_id=1, card=make_srs_card(due=_NOW))])
    service = _service(study=study)

    result = await service.review_item(1, SrsRating.GOOD)

    assert result.item.card.due > _NOW  # StubSrsEngine pushes it out a day
    assert study.items[0].card.due == result.item.card.due  # persisted
    assert [log.rating for log in study.review_logs[1]] == [SrsRating.GOOD]
    assert result.log.rating is SrsRating.GOOD


async def test_review_item_unknown_raises_not_found() -> None:
    service = _service(study=FakeStudyItemRepository())

    with pytest.raises(ResourceNotFoundError):
        await service.review_item(999, SrsRating.AGAIN)


async def test_review_item_not_yet_due_is_rejected() -> None:
    not_due = make_study_item(item_id=1, card=make_srs_card(due=_NOW.replace(year=2027)))
    study = FakeStudyItemRepository([not_due])
    service = _service(study=study)

    with pytest.raises(ConflictError):
        await service.review_item(1, SrsRating.GOOD)

    assert study.review_logs == {}  # nothing was written
    assert study.history.rows == []  # no history row either
    assert study.items[0].card.due == _NOW.replace(year=2027)  # card untouched


async def test_item_reviews_lists_history_newest_first() -> None:
    study = FakeStudyItemRepository([make_study_item(item_id=1)])
    await study.add_review_log(1, SrsReviewLog(rating=SrsRating.GOOD, review_datetime=_NOW))
    await study.add_review_log(1, SrsReviewLog(rating=SrsRating.AGAIN, review_datetime=_NOW.replace(year=2027)))
    service = _service(study=study)

    history = await service.item_reviews(1)

    assert [log.rating for log in history] == [SrsRating.AGAIN, SrsRating.GOOD]


async def test_item_reviews_unknown_raises_not_found() -> None:
    service = _service(study=FakeStudyItemRepository())

    with pytest.raises(ResourceNotFoundError):
        await service.item_reviews(999)


# --- import_batch ---------------------------------------------------------

_XUE_XI = DictionaryEntry(id=1, simplified="学习", pinyin="xue2 xi2", definitions=("to study",))
_NI_HAO = DictionaryEntry(id=2, simplified="你好", pinyin="ni3 hao3", definitions=("hello",))


def _batch_service(
    entries: list[DictionaryEntry], study: FakeStudyItemRepository | None = None
) -> tuple[StudyService, FakeStudyItemRepository]:
    study = study or FakeStudyItemRepository()
    service = _service(study=study, dictionary=FakeDictionaryRepository(entries))
    return service, study


async def test_import_batch_creates_items_for_matching_rows() -> None:
    service, study = _batch_service([_XUE_XI, _NI_HAO])

    report = await service.import_batch(
        [BatchImportRow(hanzi="学习", pinyin="xue2 xi2"), BatchImportRow(hanzi=" 你好 ", pinyin=" ni3 hao3 ")]
    )

    assert [o.status for o in report.outcomes] == [BatchRowStatus.CREATED, BatchRowStatus.CREATED]
    assert {i.entry.id for i in study.items} == {1, 2}
    assert report.outcomes[0].study_item_id == study.items[0].id


async def test_import_batch_reports_empty_hanzi_and_bad_pinyin_format() -> None:
    service, study = _batch_service([_XUE_XI])

    report = await service.import_batch(
        [BatchImportRow(hanzi="", pinyin="xue2 xi2"), BatchImportRow(hanzi="学习", pinyin="xué xí")]
    )

    assert [o.status for o in report.outcomes] == [BatchRowStatus.ERROR, BatchRowStatus.ERROR]
    assert report.outcomes[0].detail == "hanzi vazio"
    assert "formato" in (report.outcomes[1].detail or "")
    assert study.items == []


async def test_import_batch_matches_regardless_of_case_and_u_spelling() -> None:
    # stored pinyin is sanitised on import (lower-cased, u: -> v); the row is
    # sanitised the same way before the exact match, so e.g. proper-noun
    # capitalisation and the u:/ü digraphs still resolve.
    beijing = DictionaryEntry(id=3, simplified="北京", pinyin="bei3 jing1", definitions=("Beijing",))
    lu = DictionaryEntry(id=4, simplified="绿", pinyin="lv4", definitions=("green",))
    service, study = _batch_service([beijing, lu])

    report = await service.import_batch(
        [BatchImportRow(hanzi="北京", pinyin="Bei3 jing1"), BatchImportRow(hanzi="绿", pinyin="lu:4")]
    )

    assert [o.status for o in report.outcomes] == [BatchRowStatus.CREATED, BatchRowStatus.CREATED]
    assert {i.entry.id for i in study.items} == {3, 4}


async def test_import_batch_reports_unknown_hanzi_and_wrong_reading() -> None:
    service, _ = _batch_service([_XUE_XI])

    report = await service.import_batch(
        [BatchImportRow(hanzi="没有", pinyin="mei2 you3"), BatchImportRow(hanzi="学习", pinyin="xue2 xi5")]
    )

    assert report.outcomes[0].detail == "hanzi não encontrado no dicionário"
    assert report.outcomes[0].candidates == ()
    assert "to study" in (report.outcomes[1].detail or "")
    assert [c.id for c in report.outcomes[1].candidates] == [1]  # offered so it can be added manually anyway


async def test_import_batch_reports_ambiguous_match_with_candidates() -> None:
    reading_a = DictionaryEntry(id=10, simplified="行", pinyin="xing2", definitions=("to walk",))
    reading_b = DictionaryEntry(id=11, simplified="行", pinyin="xing2", definitions=("OK",))
    service, study = _batch_service([reading_a, reading_b])

    report = await service.import_batch([BatchImportRow(hanzi="行", pinyin="xing2")])

    assert report.outcomes[0].status is BatchRowStatus.ERROR
    assert "#10" in (report.outcomes[0].detail or "") and "#11" in (report.outcomes[0].detail or "")
    assert [c.id for c in report.outcomes[0].candidates] == [10, 11]
    assert study.items == []


async def test_import_batch_skips_rows_already_queued_or_duplicated_in_file() -> None:
    study = FakeStudyItemRepository([make_study_item(entry=_NI_HAO)])
    service, study = _batch_service([_XUE_XI, _NI_HAO], study=study)

    report = await service.import_batch(
        [
            BatchImportRow(hanzi="你好", pinyin="ni3 hao3"),  # already in the queue
            BatchImportRow(hanzi="学习", pinyin="xue2 xi2"),  # new
            BatchImportRow(hanzi="学习", pinyin="xue2 xi2"),  # duplicate within the file
        ]
    )

    assert [o.status for o in report.outcomes] == [
        BatchRowStatus.SKIPPED,
        BatchRowStatus.CREATED,
        BatchRowStatus.SKIPPED,
    ]
    assert sum(1 for i in study.items if i.entry.id == 1) == 1
