from __future__ import annotations

import pytest

from shougong.usecase.reading.vocabulary import VocabularyCategory, category_for


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        (["v"], VocabularyCategory.VERB),
        (["vn", "v"], VocabularyCategory.VERB),
        (["n"], VocabularyCategory.NOUN),
        (["nz"], VocabularyCategory.NOUN),
        (["nr"], VocabularyCategory.PERSON),
        (["ns"], VocabularyCategory.PLACE),
        (["f"], VocabularyCategory.PLACE),
        (["t"], VocabularyCategory.TIME),
        (["tg"], VocabularyCategory.TIME),
        (["m"], VocabularyCategory.QUANTITY),
        (["mq"], VocabularyCategory.QUANTITY),
        (["q"], VocabularyCategory.QUANTITY),
        (["a"], VocabularyCategory.QUALIFIER),
        (["b"], VocabularyCategory.QUALIFIER),
        (["d"], VocabularyCategory.ADVERB),
        (["c"], VocabularyCategory.CONNECTIVE),
        (["r"], VocabularyCategory.PRONOUN),
        (["u"], VocabularyCategory.FUNCTIONAL),
        (["y", "e"], VocabularyCategory.FUNCTIONAL),
        ([], VocabularyCategory.OTHER),
        (["x"], VocabularyCategory.OTHER),
    ],
)
def test_category_for_maps_hsk_pos_tags(tags: list[str], expected: VocabularyCategory) -> None:
    assert category_for("测试", tags) is expected


def test_the_functional_core_wins_over_the_pos_tags() -> None:
    # 会 is tagged as a verb in the dataset, but it is in the fixed function core.
    assert category_for("会", ["v"]) is VocabularyCategory.FUNCTIONAL
    assert category_for("的", []) is VocabularyCategory.FUNCTIONAL


def test_more_specific_buckets_are_checked_before_generic_noun() -> None:
    # a time noun tagged both t and n must land in TIME, not NOUN
    assert category_for("今天", ["t", "n"]) is VocabularyCategory.TIME


def test_a_numeral_carrying_a_stray_time_tag_is_still_quantity() -> None:
    # 一 is tagged m/d/t in the dataset — it is plainly a number
    assert category_for("一二三", ["m", "d", "t"]) is VocabularyCategory.QUANTITY
