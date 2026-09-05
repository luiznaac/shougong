"""The one test that exercises real jieba, not a fake — confirms segmentation
and POS tagging actually work end-to-end for a few sample sentences."""

from __future__ import annotations

from shougong.segmentation.jieba_segmenter import JiebaSegmenter


def test_segments_a_simple_sentence_into_words_with_pos_tags() -> None:
    tokens = JiebaSegmenter().segment("我是学生。")

    words = [t.text for t in tokens]
    assert "我" in words
    assert "是" in words
    assert "学生" in words
    assert all(t.pos_tag for t in tokens)  # every token got some tag, including punctuation


def test_known_compound_is_segmented_as_one_word_not_its_characters() -> None:
    tokens = JiebaSegmenter().segment("他喜欢吃葡萄。")

    words = [t.text for t in tokens]
    assert "葡萄" in words
    assert "喜欢" in words
