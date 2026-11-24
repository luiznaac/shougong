from __future__ import annotations

from shougong.usecase.dictionary.model import group_entries
from tests.fixtures import make_dictionary_entry


def test_group_entries_collects_the_meanings_of_one_word_and_reading() -> None:
    groups = group_entries(
        [
            make_dictionary_entry(entry_id=2, simplified="和", pinyin="he2", definitions=("surname He",)),
            make_dictionary_entry(entry_id=1, simplified="和", pinyin="he2", definitions=("and", "with")),
            make_dictionary_entry(entry_id=3, simplified="学", pinyin="xue2", definitions=("to learn",)),
        ]
    )

    assert [(group.simplified, group.pinyin) for group in groups] == [("和", "he2"), ("学", "xue2")]
    assert [(meaning.entry_id, meaning.definitions) for meaning in groups[0].meanings] == [
        (1, ("and", "with")),
        (2, ("surname He",)),
    ]
    assert [meaning.entry_id for meaning in groups[1].meanings] == [3]


def test_group_entries_keeps_different_readings_apart() -> None:
    groups = group_entries(
        [
            make_dictionary_entry(entry_id=1, simplified="和", pinyin="he2", definitions=("and",)),
            make_dictionary_entry(entry_id=2, simplified="和", pinyin="he4", definitions=("to join in singing",)),
        ]
    )

    assert [(group.simplified, group.pinyin) for group in groups] == [("和", "he2"), ("和", "he4")]


def test_group_entries_orders_shortest_word_first_then_first_entry() -> None:
    groups = group_entries(
        [
            make_dictionary_entry(entry_id=9, simplified="学习", pinyin="xue2 xi2", definitions=("to study",)),
            make_dictionary_entry(entry_id=4, simplified="学", pinyin="xue2", definitions=("to learn",)),
            make_dictionary_entry(entry_id=7, simplified="和", pinyin="he2", definitions=("and",)),
        ]
    )

    # Same length ties break on the group's first entry id (学 is id 4, 和 is id 7).
    assert [group.simplified for group in groups] == ["学", "和", "学习"]


def test_group_entries_carries_the_word_levels_and_pos() -> None:
    groups = group_entries(
        [
            make_dictionary_entry(
                entry_id=1,
                simplified="学",
                pinyin="xue2",
                hsk_level=1,
                pos_tags=("v", "n"),
                handwriting_level=2,
            ),
            make_dictionary_entry(entry_id=2, simplified="学", pinyin="xue2", definitions=("to study",)),
        ]
    )

    group = groups[0]
    assert (group.hsk_level, group.pos_tags, group.handwriting_level) == (1, ("v", "n"), 2)
