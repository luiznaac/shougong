from __future__ import annotations

import pytest

from shougong.usecase.dictionary.model import HskDatasetWord
from shougong.usecase.reading.vocabulary import VocabularyCategory, categories_for, hsk_level_stats

C = VocabularyCategory


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        (["v"], {C.VERB}),
        (["vn", "v"], {C.VERB}),
        (["n"], {C.NOUN}),
        (["nz"], {C.NOUN}),
        (["nr"], {C.PERSON}),
        (["ns"], {C.PLACE}),
        (["nt"], {C.PLACE}),
        (["f"], {C.NOUN}),  # localiser → noun, not place
        (["s"], {C.NOUN}),
        (["t"], {C.TIME}),
        (["tg"], {C.TIME}),
        (["m"], {C.QUANTITY}),
        (["mq"], {C.QUANTITY}),
        (["q"], {C.QUANTITY}),
        (["a"], {C.QUALIFIER}),
        (["b"], {C.QUALIFIER}),
        (["d"], {C.ADVERB}),
        (["c"], {C.CONNECTIVE}),
        (["r"], {C.PRONOUN}),
        (["u"], {C.FUNCTIONAL}),
        (["y", "e"], {C.FUNCTIONAL}),
        ([], {C.OTHER}),
        (["x"], {C.OTHER}),
    ],
)
def test_categories_for_maps_hsk_pos_tags(tags: list[str], expected: set[VocabularyCategory]) -> None:
    assert categories_for("测试", tags) == frozenset(expected)


def test_a_word_lands_in_every_category_its_tags_imply() -> None:
    # a noun-verb tagged with both v and n belongs to both groups
    assert categories_for("学习", ["v", "n"]) == frozenset({C.VERB, C.NOUN})
    assert categories_for("代表", ["v", "n", "vn"]) == frozenset({C.VERB, C.NOUN})


def test_function_words_are_exclusively_functional() -> None:
    # 会 is tagged as a verb in the dataset, but it is in the fixed function core
    assert categories_for("会", ["v"]) == frozenset({C.FUNCTIONAL})
    assert categories_for("的", []) == frozenset({C.FUNCTIONAL})
    # a particle tag wins outright, no other category comes along
    assert categories_for("着", ["u", "v"]) == frozenset({C.FUNCTIONAL})


def test_person_is_split_out_but_places_are_only_proper_names() -> None:
    assert categories_for("小明", ["nr"]) == frozenset({C.PERSON})
    assert categories_for("北京", ["ns"]) == frozenset({C.PLACE})
    assert categories_for("里", ["f"]) == frozenset({C.FUNCTIONAL})  # 里 is in FUNCTIONAL_CORE
    assert categories_for("旁边", ["f"]) == frozenset({C.NOUN})


def test_hsk_level_stats_counts_distinct_totals_and_isolates_function_words() -> None:
    words = [
        HskDatasetWord("阿姨", 4, ("n",)),
        HskDatasetWord("北京", 2, ("ns",)),
        HskDatasetWord("他", 1, ("r",)),
        HskDatasetWord("的", 1, ("u",)),
        HskDatasetWord("了", 1, ("u",)),
        HskDatasetWord("会", 2, ("v",)),  # in FUNCTIONAL_CORE
        HskDatasetWord("生词", None, ("n",)),  # no level → ignored
    ]

    stats = hsk_level_stats(words)

    assert stats.total_by_level == {4: 1, 2: 2, 1: 3}
    assert stats.functional_by_level[1] == frozenset({"的", "了"})
    assert stats.functional_by_level[2] == frozenset({"会"})
    assert "他" not in stats.functional_by_level.get(1, frozenset())
