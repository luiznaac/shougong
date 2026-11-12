"""Coverage invariants for the committed acceptance fixture (issue #140).

The fixture is what lets the runbook reach the list surfaces on a clean MySQL, so
these tests pin the coverage the issue asks for without needing a database: more
than one 24-row page, every SRS state, every HSK bucket, a leech and a pin.
"""

from __future__ import annotations

from datetime import UTC, datetime
from itertools import pairwise

import pytest

from shougong.acceptance.fixture import AcceptanceFixture, StudyItemRow, build_fixture
from shougong.usecase.insights.model import GradeWindow, ReviewGrade
from shougong.usecase.insights.policy import WINDOW_SIZE, is_leech
from shougong.usecase.srs.model import SrsState

_NOW = datetime(2026, 6, 1, 12, tzinfo=UTC)
_ITEM_PAGE_SIZE = 24
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
    assert pinned
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
