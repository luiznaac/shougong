"""The one test that exercises real jieba, not a fake — confirms segmentation
and POS tagging actually work end-to-end for a few sample sentences."""

from __future__ import annotations

from shougong.segmentation.jieba_segmenter import JiebaSegmenter
from shougong.usecase.reading.model import PartOfSpeech


def test_segments_a_simple_sentence_into_words_with_part_of_speech() -> None:
    tokens = JiebaSegmenter().segment("我是学生。")

    by_text = {t.text: t for t in tokens}
    assert "我" in by_text
    assert "是" in by_text
    assert "学生" in by_text
    assert by_text["学生"].part_of_speech is PartOfSpeech.NOUN
    assert by_text["。"].part_of_speech is None  # punctuation has no grammatical class


def test_known_compound_is_segmented_as_one_word_not_its_characters() -> None:
    tokens = JiebaSegmenter().segment("他喜欢吃葡萄。")

    words = [t.text for t in tokens]
    assert "葡萄" in words
    assert "喜欢" in words
