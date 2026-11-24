from __future__ import annotations

from shougong.usecase.dictionary.import_policy import (
    apply_import_policy,
    duplicate_key,
    is_variant_gloss,
    select_cleanup_ids,
)
from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry


def _record(simplified: str, pinyin: str, definitions: tuple[str, ...]) -> CedictRecord:
    return CedictRecord(simplified=simplified, pinyin=pinyin, definitions=definitions)


def _entry(entry_id: int, simplified: str, pinyin: str, definitions: tuple[str, ...]) -> DictionaryEntry:
    return DictionaryEntry(id=entry_id, simplified=simplified, pinyin=pinyin, definitions=definitions)


def test_is_variant_gloss_reads_the_primary_gloss() -> None:
    assert is_variant_gloss(("old variant of 寇[Kou4]",))
    assert is_variant_gloss(("variant of 從|从[cong2]",))
    assert is_variant_gloss(("(literary) harmonious (variant of 和[he2])",))
    assert is_variant_gloss(("erhua form of 花[hua1]",))
    assert not is_variant_gloss(("to learn", "to study"))
    assert not is_variant_gloss(("water",))


def test_a_real_entry_that_merely_notes_a_variant_later_is_not_a_variant() -> None:
    # 了 liao3 carries "to finish" as its primary sense; the trailing variant
    # note must not make the whole record an alias.
    assert not is_variant_gloss(("to finish", "variant of 瞭|了[liao3]"))


def test_duplicate_key_is_the_byte_identical_triple() -> None:
    record = _record("和", "he2", ("and", "sum"))

    assert duplicate_key(record) == ("和", "he2", ("and", "sum"))


def test_apply_import_policy_drops_a_variant_when_a_real_sibling_exists() -> None:
    real = _record("吃", "chi1", ("to eat",))
    alias = _record("吃", "chi1", ("variant of 吃[chi1]",))

    assert apply_import_policy([alias, real]) == [real]


def test_apply_import_policy_keeps_a_variant_only_character_searchable() -> None:
    alias = _record("㑳", "zhou4", ("old variant of 媰[zhou4]",))

    assert apply_import_policy([alias]) == [alias]


def test_apply_import_policy_drops_byte_identical_duplicates() -> None:
    first = _record("水", "shui3", ("water",))
    duplicate = _record("水", "shui3", ("water",))

    assert apply_import_policy([first, duplicate]) == [first]


def test_apply_import_policy_keeps_genuine_homographs() -> None:
    below = _record("下面", "xia4 mian4", ("below", "under"))
    noodles = _record("下面", "xia4 mian4", ("to boil noodles",))

    assert apply_import_policy([below, noodles]) == [below, noodles]


def test_select_cleanup_ids_drops_variants_with_a_real_sibling_and_duplicates() -> None:
    entries = [
        _entry(1, "吃", "chi1", ("to eat",)),
        _entry(2, "吃", "chi1", ("variant of 吃[chi1]",)),
        _entry(3, "水", "shui3", ("water",)),
        _entry(4, "水", "shui3", ("water",)),
        _entry(5, "㑳", "zhou4", ("old variant of 媰[zhou4]",)),
    ]

    assert select_cleanup_ids(entries, protected=frozenset()) == {2, 4}


def test_select_cleanup_ids_keeps_variant_only_characters() -> None:
    entries = [_entry(1, "㑳", "zhou4", ("old variant of 媰[zhou4]",))]

    assert select_cleanup_ids(entries, protected=frozenset()) == set()


def test_select_cleanup_ids_never_deletes_a_protected_row() -> None:
    entries = [
        _entry(1, "吃", "chi1", ("to eat",)),
        _entry(2, "吃", "chi1", ("variant of 吃[chi1]",)),
        _entry(3, "水", "shui3", ("water",)),
        _entry(4, "水", "shui3", ("water",)),
    ]

    # row 2 is a variant with a real sibling but a study item queued it; row 3 is
    # the protected copy of a duplicate pair. Both must survive.
    assert select_cleanup_ids(entries, protected=frozenset({2, 3})) == {4}
