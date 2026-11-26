"""Pure unit tests for the HanziHero CSV parser and numbered-pinyin transform."""

from __future__ import annotations

import pytest

from shougong.usecase.hanzihero.export import parse_export, parse_exports, to_numbered_pinyin
from shougong.usecase.hanzihero.model import HanziHeroExportFormatError, HanziHeroExports, HanziHeroSyncRow
from tests.hanzihero_fake import CHARACTERS_HEADER, DICTIONARY_HEADER, WORDS_HEADER


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("shou3gong1", "shou3 gong1"),
        ("zhi1zhong1", "zhi1 zhong1"),
        ("pian2yi5", "pian2 yi5"),  # neutral-tone second syllable
        ("le5", "le5"),  # a single neutral-tone syllable
        ("nv3er2", "nv3 er2"),  # v spells ü
        ("lv4", "lv4"),
        ("Lu:4", "lv4"),  # u: spelling, upper-cased
        ("xue2 xi2", "xue2 xi2"),  # already spaced
    ],
)
def test_to_numbered_pinyin_splits_syllables_and_keeps_tones(raw: str, expected: str) -> None:
    assert to_numbered_pinyin(raw) == expected


def test_parse_character_export_reads_the_character_column_and_drops_skipped() -> None:
    text = (
        CHARACTERS_HEADER + "一,yī,one,8,yi1,1,,,false\n" + "了,le,did,8,le5,,,,false\n" + "不,bù,no,8,bu4,not,,,true\n"
    )

    rows = parse_export(text, join_column="character")

    assert rows == [HanziHeroSyncRow(hanzi="一", pinyin="yi1"), HanziHeroSyncRow(hanzi="了", pinyin="le5")]


def test_parse_word_export_handles_quoted_commas_before_the_pinyin_column() -> None:
    text = WORDS_HEADER + '手工,shǒugōng,"handmade, done by hand",7,shou3gong1,"made by hand;handwork",,,false\n'

    rows = parse_export(text, join_column="word")

    assert rows == [HanziHeroSyncRow(hanzi="手工", pinyin="shou3 gong1")]


def test_parse_dictionary_export_handles_double_colon_joined_definitions() -> None:
    text = (
        DICTIONARY_HEADER
        + "之中,zhīzhōng,inside,1,zhi1zhong1,inside::among::in the midst of (doing sth)::during,,,false\n"
        + "便宜,piányi,cheap; inexpensive,5,pian2yi5,cheap; inexpensive::a petty advantage,,,false\n"
        + "便宜,biànyí,cheap,2,bian4yi2,convenient,cheap,,true\n"
    )

    rows = parse_export(text, join_column="entry")

    assert rows == [
        HanziHeroSyncRow(hanzi="之中", pinyin="zhi1 zhong1"),
        HanziHeroSyncRow(hanzi="便宜", pinyin="pian2 yi5"),
    ]


def test_parse_export_rejects_a_header_that_names_a_different_join_column() -> None:
    with pytest.raises(HanziHeroExportFormatError):
        parse_export(WORDS_HEADER, join_column="character")


def test_parse_export_rejects_a_header_without_the_numbered_pinyin_column() -> None:
    text = "character,pinyin,meaning,srs_stage,skipped\n一,yī,one,8,false\n"

    with pytest.raises(HanziHeroExportFormatError):
        parse_export(text, join_column="character")


def test_parse_export_rejects_a_header_without_the_skipped_column() -> None:
    text = "character,pinyin,meaning,srs_stage,numbered_pinyin\n一,yī,one,8,yi1\n"

    with pytest.raises(HanziHeroExportFormatError):
        parse_export(text, join_column="character")


def test_parse_exports_dedupes_rows_across_the_three_files_by_hanzi_and_reading() -> None:
    characters = CHARACTERS_HEADER + "一,yī,one,8,yi1,1,,,false\n"
    words = WORDS_HEADER + "一,yī,one,8,yi1,,,,false\n" + "手工,shǒugōng,handmade,7,shou3gong1,,, ,false\n"
    dictionary = (
        DICTIONARY_HEADER
        + "一,yī,one,8,yi1,one,,,false\n"
        + "手工,shǒugōng,handmade,8,shou3gong1,handmade,,,true\n"
        + "便宜,piányi,cheap,5,pian2yi5,cheap,,,false\n"
        + "便宜,biànyí,cheap,2,bian4yi2,convenient,cheap,,false\n"
    )

    rows = parse_exports(HanziHeroExports(characters=characters, words=words, dictionary=dictionary))

    assert rows == (
        HanziHeroSyncRow(hanzi="一", pinyin="yi1"),
        HanziHeroSyncRow(hanzi="手工", pinyin="shou3 gong1"),
        HanziHeroSyncRow(hanzi="便宜", pinyin="pian2 yi5"),
        HanziHeroSyncRow(hanzi="便宜", pinyin="bian4 yi2"),
    )
