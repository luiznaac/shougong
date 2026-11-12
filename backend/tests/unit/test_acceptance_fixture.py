"""Coverage invariants for the committed acceptance fixture (issues #140, #144).

The fixture is what lets the runbook reach the list and item-detail surfaces on a
clean MySQL, so these tests pin the coverage the issues ask for without needing a
database: more than one 24-row page, every SRS state, every HSK bucket, a leech
and a pin, plus the 知道 detail word's related family, trajectory, readings and
stroke cache.
"""

from __future__ import annotations

from datetime import UTC, datetime
from itertools import pairwise

import pytest

from shougong.acceptance.fixture import DETAIL_WORD, AcceptanceFixture, StudyItemRow, build_fixture
from shougong.usecase.insights.model import GradeWindow, ReviewGrade
from shougong.usecase.insights.policy import WINDOW_SIZE, is_leech
from shougong.usecase.reading.model import ReadingFormat, ReadingWord
from shougong.usecase.srs.model import SrsState

_NOW = datetime(2026, 6, 1, 12, tzinfo=UTC)
_ITEM_PAGE_SIZE = 24
_RELATED_PAGE_SIZE = 8
_HSK_BUCKETS: set[int | None] = {*range(1, 10), None}


@pytest.fixture(scope="module")
def fixture() -> AcceptanceFixture:
    return build_fixture(_NOW)


def _window(row: StudyItemRow) -> GradeWindow:
    reviews = sorted(row.reviews, key=lambda review: review.reviewed_at, reverse=True)
    return GradeWindow(
        study_item_id=0,
        grades=tuple(ReviewGrade(review.rating, review.reviewed_at) for review in reviews[:WINDOW_SIZE]),
    )


def test_fixture_exceeds_one_item_page(fixture: AcceptanceFixture) -> None:
    assert len(fixture.study_items) > _ITEM_PAGE_SIZE


def test_fixture_covers_every_hsk_bucket(fixture: AcceptanceFixture) -> None:
    assert {row.entry.hsk_level for row in fixture.study_items} == _HSK_BUCKETS


def test_fixture_covers_every_srs_state(fixture: AcceptanceFixture) -> None:
    assert {row.state for row in fixture.study_items} == set(SrsState)


def test_fixture_contains_a_leech(fixture: AcceptanceFixture) -> None:
    assert any(is_leech(_window(row)) for row in fixture.study_items)


def test_fixture_contains_a_pinned_learning_item(fixture: AcceptanceFixture) -> None:
    pinned = [row for row in fixture.study_items if row.priority_position is not None]
    assert len(pinned) == 1
    assert all(row.state is SrsState.LEARNING for row in pinned)


def test_fixture_carries_dictionary_entries_without_study_items(fixture: AcceptanceFixture) -> None:
    studied = {row.entry.simplified for row in fixture.study_items}
    dictionary_only = {row.simplified for row in fixture.dictionary_only}
    assert dictionary_only
    assert studied.isdisjoint(dictionary_only)


def test_every_entry_is_searchable_and_graded(fixture: AcceptanceFixture) -> None:
    entries = [row.entry for row in fixture.study_items] + list(fixture.dictionary_only)
    assert all(entry.definitions for entry in entries)
    assert all(entry.pinyin == entry.pinyin.lower() and "ü" not in entry.pinyin for entry in entries)
    assert all(entry.pos_tags for entry in entries)


def test_every_study_item_has_a_history_trail(fixture: AcceptanceFixture) -> None:
    assert all(row.history for row in fixture.study_items)


def test_graduating_items_show_a_learning_to_review_transition(fixture: AcceptanceFixture) -> None:
    graduating = [row for row in fixture.study_items if row.state is not SrsState.LEARNING]
    assert graduating
    for row in graduating:
        states = [snapshot.state for snapshot in row.history]
        graduated = [
            previous is SrsState.LEARNING and current is SrsState.REVIEW for previous, current in pairwise(states)
        ]
        assert any(graduated)


def test_due_dates_span_past_and_future(fixture: AcceptanceFixture) -> None:
    due = [row.due for row in fixture.study_items]
    assert any(moment < _NOW for moment in due)
    assert any(moment > _NOW for moment in due)


def _detail_item(fixture: AcceptanceFixture) -> StudyItemRow:
    return next(row for row in fixture.study_items if row.entry.simplified == DETAIL_WORD)


def _related_entries(fixture: AcceptanceFixture) -> list[str]:
    detail = _detail_item(fixture).entry
    characters = set(detail.simplified)
    entries = [row.entry.simplified for row in fixture.study_items] + [
        entry.simplified for entry in fixture.dictionary_only
    ]
    return [simplified for simplified in entries if simplified != detail.simplified and characters & set(simplified)]


def test_the_detail_word_is_the_first_study_item(fixture: AcceptanceFixture) -> None:
    # The walkthrough opens /biblioteca/itens/1, so the detail word must take
    # study item id 1 on a clean database.
    assert fixture.study_items[0].entry.simplified == DETAIL_WORD


def test_the_detail_item_is_a_pinned_multi_character_learning_word(fixture: AcceptanceFixture) -> None:
    detail = _detail_item(fixture)

    assert len(detail.entry.simplified) > 1
    assert detail.state is SrsState.LEARNING
    assert detail.priority_position is not None


def test_the_detail_family_pairs_the_learning_word_with_a_review_item(fixture: AcceptanceFixture) -> None:
    detail = _detail_item(fixture)
    neighbours = [
        row
        for row in fixture.study_items
        if row is not detail and set(row.entry.simplified) & set(detail.entry.simplified)
    ]

    assert any(row.state is SrsState.REVIEW for row in neighbours)


def test_the_detail_item_has_a_multi_point_trajectory(fixture: AcceptanceFixture) -> None:
    detail = _detail_item(fixture)

    assert len(detail.history) >= 2
    assert detail.stability is not None
    assert detail.difficulty is not None


def test_the_detail_card_matches_its_latest_snapshot(fixture: AcceptanceFixture) -> None:
    detail = _detail_item(fixture)
    latest = detail.history[-1]

    assert (detail.stability, detail.difficulty, detail.due, detail.last_review) == (
        latest.stability,
        latest.difficulty,
        latest.due,
        latest.last_review,
    )


def test_the_detail_word_shares_characters_with_more_than_one_related_page(fixture: AcceptanceFixture) -> None:
    related = _related_entries(fixture)

    assert len(related) > _RELATED_PAGE_SIZE


def test_the_related_family_queues_at_least_one_word(fixture: AcceptanceFixture) -> None:
    studied = {row.entry.simplified for row in fixture.study_items}
    detail = _detail_item(fixture).entry.simplified

    assert any(simplified in studied and simplified != detail for simplified in _related_entries(fixture))


def test_at_least_two_readings_contain_the_detail_word(fixture: AcceptanceFixture) -> None:
    word = _detail_item(fixture).entry.simplified
    matching = [
        row
        for row in fixture.readings
        if any(isinstance(token, ReadingWord) and token.text == word for token in row.tokens)
    ]

    assert len(matching) >= 2


def test_one_reading_carries_an_extra_word(fixture: AcceptanceFixture) -> None:
    assert any(isinstance(token, ReadingWord) and token.is_extra for row in fixture.readings for token in row.tokens)


def test_the_dialogue_reading_carries_its_cast(fixture: AcceptanceFixture) -> None:
    dialogue = next(row for row in fixture.readings if row.format is ReadingFormat.DIALOGUE)
    speakers = {speaker.name for speaker in dialogue.speakers}

    assert len(speakers) >= 2
    assert all(token.speaker in speakers for token in dialogue.tokens)


def test_strokes_cover_every_character_of_the_detail_word(fixture: AcceptanceFixture) -> None:
    detail = _detail_item(fixture).entry.simplified
    cached = {row.character for row in fixture.strokes}

    assert set(detail) <= cached
    assert all(row.strokes for row in fixture.strokes)
