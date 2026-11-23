"""The official HSK 3.0 word list (`ivankra/hsk30`), parsed locally."""

from __future__ import annotations

import httpx
from pytest_httpserver import HTTPServer

from shougong.gateway.dictionary.official_hsk_source import OfficialHskSource, parse_official_words

_CSV = """ID,Simplified,Traditional,Pinyin,POS,Level,WebNo,WebPinyin,OCR,Variants,CEDICT
L1-0001,爱,愛,ài,V,1,18,ài,爱,,愛|爱[ai4]
L1-0004,爸爸|爸,爸爸|爸,bàba|bà,N,1,83,bàba|bà,爸爸｜爸,,爸爸|爸爸[ba4 ba5]
L2-0001,吧,吧,ba,Aux,2,89,ba,吧,,吧|吧[ba5]
L3-0001,白,白,bái,Adj,3,100,bái,白,,白|白[bai2]
L6-0001,蕴含,蘊含,yùnhán,V,6,200,yùnhán,蕴含,,蘊含|蕴含[yun4 han2]
L7-0001,阿拉伯语,阿拉伯語,ālābóyǔ,N,7-9,300,ālābóyǔ,阿拉伯语,,阿拉伯語|阿拉伯语[a1 la1 bo2 yu3]
L1-9001,第（第二）,第（第二）,dì,V,1,400,dì,第（第二）,,第|第[di4]
L2-9002,称1,稱1,chēng,V,2,401,chēng,称1,,稱|称[cheng1]
L1-9003,有（一）些,有（一）些,yǒu yī xiē,Num,1,402,yǒu xiē,有（一）些,,有些|有些[you3 xie1]
L3-9004,…极了,…,jí le,Adv,3,403,jí le,…极了,,极了|极了[ji2 le5]
"""


def test_parse_official_words_reduces_usage_notation_to_the_headword() -> None:
    words = parse_official_words(_CSV)

    assert words["第"] == 1  # `第（第二）` → 第
    assert words["称"] == 2  # `称1` → 称
    assert words["有些"] == 1  # `有（一）些` → 有些
    assert words["极了"] == 3  # `…极了` → 极了


def test_parse_official_words_keeps_each_words_level() -> None:
    words = parse_official_words(_CSV)

    assert words["爱"] == 1
    assert words["吧"] == 2
    assert words["蕴含"] == 6


def test_parse_official_words_collapses_the_7_to_9_band_to_level_7() -> None:
    words = parse_official_words(_CSV)

    assert words["阿拉伯语"] == 7


def test_parse_official_words_splits_pipe_separated_forms() -> None:
    words = parse_official_words(_CSV)

    assert words["爸爸"] == 1
    assert words["爸"] == 1


def test_parse_official_words_keeps_the_lowest_level_for_a_word_listed_twice() -> None:
    # 白 appears at level 3 in the sample; a second row at level 1 must win.
    words = parse_official_words(_CSV + "L1-9999,白,白,bái,Adj,1,1,bái,白,,白|白[bai2]\n")

    assert words["白"] == 1


def test_parse_official_words_ignores_blank_forms() -> None:
    words = parse_official_words(_CSV + "L9-9999,,,x,X,1,1,x,,,\n")

    assert "" not in words


async def test_fetch_downloads_once_and_caches(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/hsk30.csv", method="GET").respond_with_data(_CSV, content_type="text/csv")

    async with httpx.AsyncClient() as client:
        source = OfficialHskSource(client, httpserver.url_for("/hsk30.csv"))
        first = await source.fetch()
        second = await source.fetch()

    assert first is second  # cached
    assert len(httpserver.log) == 1  # downloaded only once
    assert first["阿拉伯语"] == 7
