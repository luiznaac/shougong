"""The committed acceptance fixture for the list and item-detail surfaces.

`docs/acceptance-runbook.md` boots MySQL empty, so the walkthroughs need a seed
the runbook itself can apply. `build_fixture` is the deterministic data plan —
dictionary entries and study items covering more than one 24-row page, every SRS
state, every HSK bucket (1..9 and none), a leech and a pinned item — plus the
item-detail rows: the 知道 detail word, its shared-character family, three
readings that contain it and cached strokes for both of its characters.
`apply_acceptance_fixture` writes it in one transaction, only when the
dictionary is empty, so re-running the runbook is a no-op.

Times are relative to the invocation instant: the fixture stays meaningful on
any acceptance day instead of ageing out with hard-coded dates.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import create_async_engine

from shougong.acceptance.stroke_cache import CACHED_STROKES, StrokeMedians
from shougong.application.settings import Settings
from shougong.persistence.configuration.database import build_session_factory
from shougong.persistence.configuration.time import naive_utc
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.persistence.reading.entity import ReadingTextEntity
from shougong.persistence.reading.repository import to_entity
from shougong.persistence.strokes.entity import CharacterStrokesEntity
from shougong.persistence.study.entity import ReviewLogEntity, StudyItemEntity, StudyItemPriorityEntity
from shougong.persistence.study_item_history.entity import StudyItemHistoryEntity
from shougong.usecase.commons.logging import get_logger
from shougong.usecase.reading.model import (
    GeneratedReading,
    GenerationAttempt,
    PartOfSpeech,
    ReadingFormat,
    ReadingPunctuation,
    ReadingRequest,
    ReadingSpeaker,
    ReadingToken,
    ReadingWord,
)
from shougong.usecase.srs.model import SrsRating, SrsState

_log = get_logger(__name__)

_LEARNING_ITEMS = 10
_REVIEW_ITEMS = 11
# The learner's known-vocabulary size recorded on each saved reading.
_KNOWN_WORD_COUNT = 120
# Pinned to the top of the plan so a clean database gives it study item id 1,
# the route the item-detail walkthrough opens.
DETAIL_WORD = "知道"
# The detail family's queued neighbour; it is the fixture's review-state row.
_DETAIL_NEIGHBOUR = "知"
# The detail card is seeded a few reviews in, so the facts line and the
# trajectory chart have real FSRS values; the last snapshot reuses these.
_DETAIL_STABILITY = 2.0
_DETAIL_DIFFICULTY = 5.5
_DETAIL_LAST_REVIEW_AGO = timedelta(days=1)
_DETAIL_DUE_IN = timedelta(hours=1)


@dataclass(frozen=True, slots=True)
class DictionaryRow:
    """One `dictionary_entry` the fixture writes."""

    simplified: str
    pinyin: str
    definitions: tuple[str, ...]
    hsk_level: int | None
    pos_tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ReviewRow:
    """One `review_log` grade, relative to the fixture's instant."""

    rating: SrsRating
    reviewed_at: datetime


@dataclass(frozen=True, slots=True)
class HistoryRow:
    """One `study_item_history` snapshot in an item's trail."""

    state: SrsState
    stability: float | None
    difficulty: float | None
    due: datetime
    last_review: datetime | None
    recorded_at: datetime


@dataclass(frozen=True, slots=True)
class StudyItemRow:
    """One `study_item` plus the rows that hang off it."""

    entry: DictionaryRow
    state: SrsState
    stability: float | None
    difficulty: float | None
    due: datetime
    last_review: datetime | None
    created_at: datetime
    priority_position: int | None
    reviews: tuple[ReviewRow, ...]
    history: tuple[HistoryRow, ...]


@dataclass(frozen=True, slots=True)
class ReadingRow:
    """One saved reading containing the detail word.

    The chosen attempt's extra words are derived from the tokens' `is_extra`
    flags, the way the summary and the reading response fall back to them. A
    dialogue row carries its cast and tags every token with its speaker.
    """

    format: ReadingFormat
    topic: str
    model: str
    tokens: tuple[ReadingToken, ...]
    created_at: datetime
    speakers: tuple[ReadingSpeaker, ...] = ()


@dataclass(frozen=True, slots=True)
class StrokesRow:
    """One cached `character_strokes` row, so the player never fetches upstream."""

    character: str
    strokes: tuple[str, ...]
    medians: StrokeMedians


@dataclass(frozen=True, slots=True)
class AcceptanceFixture:
    """The whole plan: queued items, dictionary-only entries, readings and strokes."""

    study_items: tuple[StudyItemRow, ...]
    dictionary_only: tuple[DictionaryRow, ...]
    readings: tuple[ReadingRow, ...]
    strokes: tuple[StrokesRow, ...]


@dataclass(frozen=True, slots=True)
class SeedOutcome:
    """What `apply_acceptance_fixture` wrote; a skipped run writes nothing."""

    seeded: bool
    dictionary_entries: int
    study_items: int
    readings: int
    strokes: int


# At least three words per HSK bucket, so every filter chip the item index
# renders has a match; a word in the `none` bucket is deliberately outside HSK
# 1..9. The first two are the item-detail pair: 知道 is the pinned learning
# detail word, 知 is its queued shared-character neighbour in review.
_WORDS: tuple[DictionaryRow, ...] = (
    DictionaryRow(DETAIL_WORD, "zhi1 dao4", ("to know", "to be aware of"), 1, ("v",)),
    DictionaryRow(_DETAIL_NEIGHBOUR, "zhi1", ("to know", "knowledge"), 1, ("v", "n")),
    DictionaryRow("学", "xue2", ("to learn", "to study"), 1, ("v", "n")),
    DictionaryRow("学生", "xue2 sheng1", ("student", "pupil"), 1, ("n",)),
    DictionaryRow("老师", "lao3 shi1", ("teacher",), 1, ("n",)),
    DictionaryRow("朋友", "peng2 you3", ("friend",), 2, ("n",)),
    DictionaryRow("时间", "shi2 jian1", ("time", "period"), 2, ("n",)),
    DictionaryRow("工作", "gong1 zuo4", ("work", "job"), 2, ("n", "v")),
    DictionaryRow("学校", "xue2 xiao4", ("school",), 3, ("n",)),
    DictionaryRow("城市", "cheng2 shi4", ("city", "town"), 3, ("n",)),
    DictionaryRow("环境", "huan2 jing4", ("environment", "surroundings"), 3, ("n",)),
    DictionaryRow("经验", "jing1 yan4", ("experience",), 4, ("n",)),
    DictionaryRow("支持", "zhi1 chi2", ("to support", "support"), 4, ("v", "n")),
    DictionaryRow("讨论", "tao3 lun4", ("to discuss", "discussion"), 4, ("v", "n")),
    DictionaryRow("影响", "ying3 xiang3", ("influence", "to affect"), 5, ("n", "v")),
    DictionaryRow("挑战", "tiao3 zhan4", ("challenge", "to challenge"), 5, ("n", "v")),
    DictionaryRow("沟通", "gou1 tong1", ("to communicate", "communication"), 5, ("v", "n")),
    DictionaryRow("目标", "mu4 biao1", ("goal", "target"), 6, ("n",)),
    DictionaryRow("趋势", "qu1 shi4", ("trend", "tendency"), 6, ("n",)),
    DictionaryRow("变化", "bian4 hua4", ("change", "variation"), 6, ("n", "v")),
    DictionaryRow("微妙", "wei1 miao4", ("subtle", "delicate"), 7, ("a",)),
    DictionaryRow("沉淀", "chen2 dian4", ("sediment", "to settle"), 7, ("n", "v")),
    DictionaryRow("蕴含", "yun4 han2", ("to contain", "to embody"), 7, ("v",)),
    DictionaryRow("职场", "zhi2 chang3", ("workplace",), 8, ("n",)),
    DictionaryRow("洞察", "dong4 cha2", ("insight", "to discern"), 8, ("n", "v")),
    DictionaryRow("严谨", "yan2 jun4", ("rigorous", "strict"), 8, ("a",)),
    DictionaryRow("弊端", "bi4 duan1", ("drawback", "malpractice"), 9, ("n",)),
    DictionaryRow("契机", "qi4 ji1", ("opportunity", "turning point"), 9, ("n",)),
    DictionaryRow("彰显", "zhang1 xian3", ("to manifest", "to highlight"), 9, ("v",)),
    DictionaryRow("拉面", "la1 mian4", ("ramen", "pulled noodles"), None, ("n",)),
    DictionaryRow("猫咪", "mao1 mi1", ("kitty", "cat"), None, ("n",)),
    DictionaryRow("巷子", "xiang4 zi", ("alley", "lane"), None, ("n",)),
)

# Not queued: the 学 family gives dictionary search extra rows to find,
# including words the learner can still add.
_DICTIONARY_ONLY: tuple[DictionaryRow, ...] = (
    DictionaryRow("大学", "da4 xue2", ("university",), 3, ("n",)),
    DictionaryRow("小学", "xiao3 xue2", ("primary school",), 1, ("n",)),
    DictionaryRow("中学", "zhong1 xue2", ("middle school",), 2, ("n",)),
    DictionaryRow("学院", "xue2 yuan4", ("college", "academy"), 4, ("n",)),
    DictionaryRow("学者", "xue2 zhe3", ("scholar",), 5, ("n",)),
    DictionaryRow("学术", "xue2 shu4", ("academic learning",), 6, ("n",)),
    DictionaryRow("花", "hua1", ("flower", "to spend"), 1, ("n", "v")),
    DictionaryRow("咖啡", "ka1 fei1", ("coffee",), None, ("n",)),
    # The 知道 detail word's shared-character family: twelve dictionary-only
    # rows plus the queued 知 make two 8-row related pages (8 + 5), and page
    # one includes the queued word so the panel renders its `na fila` link.
    DictionaryRow("道", "dao4", ("way", "path", "principle"), 1, ("n",)),
    DictionaryRow("知识", "zhi1 shi2", ("knowledge",), 2, ("n",)),
    DictionaryRow("味道", "wei4 dao4", ("flavor", "taste"), 3, ("n",)),
    DictionaryRow("道理", "dao4 li3", ("reason", "argument"), 3, ("n",)),
    DictionaryRow("通知", "tong1 zhi1", ("to notify", "notice"), 4, ("v", "n")),
    DictionaryRow("街道", "jie1 dao4", ("street", "avenue"), 4, ("n",)),
    DictionaryRow("通道", "tong1 dao4", ("passage", "channel"), 5, ("n",)),
    DictionaryRow("知音", "zhi1 yin1", ("close friend", "soulmate"), None, ("n",)),
    DictionaryRow("知名度", "zhi1 ming2 du4", ("fame", "visibility"), None, ("n",)),
    DictionaryRow("车道", "che1 dao4", ("traffic lane",), None, ("n",)),
    DictionaryRow("地道", "di4 dao4", ("authentic", "genuine"), None, ("a",)),
    DictionaryRow("河道", "he2 dao4", ("river channel",), None, ("n",)),
)

# Two leech windows: four and three `again` grades among the ten most recent,
# so the leech list has a worst-first order rather than a single row.
_LEECH_REVIEWS: dict[int, tuple[tuple[SrsRating, int], ...]] = {
    10: (
        (SrsRating.AGAIN, 6),
        (SrsRating.AGAIN, 5),
        (SrsRating.GOOD, 4),
        (SrsRating.AGAIN, 3),
        (SrsRating.AGAIN, 2),
    ),
    13: (
        (SrsRating.HARD, 5),
        (SrsRating.AGAIN, 4),
        (SrsRating.GOOD, 3),
        (SrsRating.AGAIN, 2),
        (SrsRating.AGAIN, 1),
    ),
}

# The remaining non-learning items carry a short, healthy history; none reaches
# the leech threshold.
_HEALTHY_REVIEWS: tuple[tuple[SrsRating, int], ...] = (
    (SrsRating.GOOD, 4),
    (SrsRating.HARD, 3),
    (SrsRating.GOOD, 1),
)


def _state_for(index: int) -> SrsState:
    if index < _LEARNING_ITEMS:
        return SrsState.LEARNING
    if index < _LEARNING_ITEMS + _REVIEW_ITEMS:
        return SrsState.REVIEW
    return SrsState.RELEARNING


def _due_instant(now: datetime, index: int) -> datetime:
    """A midnight bucket straddling today, so the due-range filter has both sides."""
    return (now + timedelta(days=(index % 15) - 6)).replace(hour=0, minute=0, second=0, microsecond=0)


def _card_metrics(state: SrsState, index: int) -> tuple[float | None, float | None]:
    if state is SrsState.LEARNING:
        return None, None
    if state is SrsState.REVIEW:
        return 1.0 + (index % 9) * 1.5, 2.5 + (index % 7) * 0.7
    return 0.5 + (index % 4) * 0.4, 6.0 + (index % 4) * 0.6


def _reviews_for(index: int, state: SrsState, now: datetime) -> tuple[ReviewRow, ...]:
    if state is SrsState.LEARNING:
        return ()
    pairs = _LEECH_REVIEWS.get(index, _HEALTHY_REVIEWS)
    return tuple(
        ReviewRow(rating=rating, reviewed_at=now - timedelta(days=days_ago, hours=index % 5))
        for rating, days_ago in pairs
    )


def _history_for(
    index: int,
    state: SrsState,
    due: datetime,
    last_review: datetime | None,
    created_at: datetime,
    stability: float | None,
    difficulty: float | None,
) -> tuple[HistoryRow, ...]:
    trail = [HistoryRow(SrsState.LEARNING, None, None, created_at, None, created_at)]
    if state is SrsState.LEARNING or last_review is None:
        return tuple(trail)
    graduated_at = last_review - timedelta(days=3) if state is SrsState.RELEARNING else last_review
    trail.append(HistoryRow(SrsState.REVIEW, stability, difficulty, due, graduated_at, graduated_at))
    if state is SrsState.RELEARNING:
        trail.append(HistoryRow(state, stability, difficulty, due, last_review, last_review))
    return tuple(trail)


def _build_item(word: DictionaryRow, index: int, now: datetime) -> StudyItemRow:
    state = _state_for(index)
    stability, difficulty = _card_metrics(state, index)
    created_at = now - timedelta(days=60 - index, hours=index % 12)
    last_review = None if state is SrsState.LEARNING else now - timedelta(days=1 + (index % 10), hours=index % 8)
    due = _due_instant(now, index)
    return StudyItemRow(
        entry=word,
        state=state,
        stability=stability,
        difficulty=difficulty,
        due=due,
        last_review=last_review,
        created_at=created_at,
        priority_position=index if index in (0, 1) else None,
        reviews=_reviews_for(index, state, now),
        history=_history_for(index, state, due, last_review, created_at, stability, difficulty),
    )


def _word(text: str, part_of_speech: PartOfSpeech, *, extra: bool = False, speaker: str | None = None) -> ReadingWord:
    # Pinyin, definitions and the entry id are hydrated on read from the live
    # dictionary; only the stored token shape is planned here.
    return ReadingWord(
        text=text,
        pinyin=None,
        definitions=(),
        part_of_speech=part_of_speech,
        is_extra=extra,
        dictionary_entry_id=None,
        speaker=speaker,
    )


def _build_readings(now: datetime) -> tuple[ReadingRow, ...]:
    """Three readings that all contain 知道, one carrying an out-of-vocabulary word.

    The item-detail readings panel filters `/reading-texts` by the detail entry,
    so every row here must carry a 知道 word token; the match snippet, the extra
    word and the format/topic variety then all render from real rows.
    """
    return (
        ReadingRow(
            format=ReadingFormat.PARAGRAPH,
            topic="No restaurante",
            model="gpt-4o-mini",
            tokens=(
                _word("我", PartOfSpeech.PRONOUN),
                _word("昨天", PartOfSpeech.NOUN),
                _word("在", PartOfSpeech.PREPOSITION),
                _word("餐厅", PartOfSpeech.NOUN, extra=True),
                _word(DETAIL_WORD, PartOfSpeech.VERB),
                _word("了", PartOfSpeech.PARTICLE),
                _word("一个", PartOfSpeech.NUMERAL),
                _word("消息", PartOfSpeech.NOUN),
                ReadingPunctuation(text="。"),
            ),
            created_at=now - timedelta(days=1),
        ),
        ReadingRow(
            format=ReadingFormat.SENTENCES,
            topic="Na escola",
            model="gpt-4o-mini",
            tokens=(
                _word("学生", PartOfSpeech.NOUN),
                _word(DETAIL_WORD, PartOfSpeech.VERB),
                _word("老师", PartOfSpeech.NOUN),
                _word("的", PartOfSpeech.PARTICLE),
                _word("工作", PartOfSpeech.NOUN),
                ReadingPunctuation(text="。"),
            ),
            created_at=now - timedelta(days=2),
        ),
        ReadingRow(
            format=ReadingFormat.DIALOGUE,
            topic="No bairro",
            model="acceptance-dialogue",
            tokens=(
                _word("朋友", PartOfSpeech.NOUN, speaker="小李"),
                _word(DETAIL_WORD, PartOfSpeech.VERB, speaker="小李"),
                _word("这", PartOfSpeech.PRONOUN, speaker="小李"),
                _word("个", PartOfSpeech.NUMERAL, speaker="小李"),
                _word("城市", PartOfSpeech.NOUN, speaker="小李"),
                _word("的", PartOfSpeech.PARTICLE, speaker="小李"),
                _word("变化", PartOfSpeech.NOUN, speaker="小李"),
                ReadingPunctuation(text="。", speaker="小李"),
                _word("我", PartOfSpeech.PRONOUN, speaker="小王"),
                _word(DETAIL_WORD, PartOfSpeech.VERB, speaker="小王"),
                _word("变化", PartOfSpeech.NOUN, speaker="小王"),
                _word("很", PartOfSpeech.ADVERB, speaker="小王"),
                _word("大", PartOfSpeech.ADJECTIVE, speaker="小王"),
                ReadingPunctuation(text="。", speaker="小王"),
            ),
            created_at=now - timedelta(days=3),
            speakers=(
                ReadingSpeaker(name="小李", pinyin="xiao3 li3"),
                ReadingSpeaker(name="小王", pinyin="xiao3 wang2"),
            ),
        ),
    )


def _build_strokes() -> tuple[StrokesRow, ...]:
    return tuple(
        StrokesRow(character=character, strokes=strokes, medians=medians)
        for character, (strokes, medians) in CACHED_STROKES.items()
    )


def _detail_history(now: datetime, created_at: datetime) -> tuple[HistoryRow, ...]:
    """Four learning snapshots, so the Trajetória chart has a real multi-point trail.

    A just-created card has no FSRS parameters; the detail walkthrough asserts
    the chart and the plain-language facts line, so the walkthrough item is
    seeded a few reviews in while still in the learning state.
    """
    return (
        HistoryRow(SrsState.LEARNING, None, None, created_at, None, created_at),
        HistoryRow(
            SrsState.LEARNING,
            0.8,
            4.2,
            now - timedelta(days=5),
            now - timedelta(days=6),
            now - timedelta(days=6),
        ),
        HistoryRow(
            SrsState.LEARNING,
            1.4,
            5.0,
            now - timedelta(days=2),
            now - timedelta(days=3),
            now - timedelta(days=3),
        ),
        HistoryRow(
            SrsState.LEARNING,
            _DETAIL_STABILITY,
            _DETAIL_DIFFICULTY,
            now + _DETAIL_DUE_IN,
            now - _DETAIL_LAST_REVIEW_AGO,
            now - _DETAIL_LAST_REVIEW_AGO,
        ),
    )


def _with_detail_trajectory(item: StudyItemRow, now: datetime) -> StudyItemRow:
    return replace(
        item,
        stability=_DETAIL_STABILITY,
        difficulty=_DETAIL_DIFFICULTY,
        due=now + _DETAIL_DUE_IN,
        last_review=now - _DETAIL_LAST_REVIEW_AGO,
        history=_detail_history(now, item.created_at),
    )


def _with_detail_neighbour(item: StudyItemRow, now: datetime) -> StudyItemRow:
    """Turn 知 into the fixture's review row, the detail family's queued neighbour."""
    index = next(index for index, word in enumerate(_WORDS) if word.simplified == _DETAIL_NEIGHBOUR)
    stability, difficulty = _card_metrics(SrsState.REVIEW, index)
    last_review = now - timedelta(days=2)
    return replace(
        item,
        state=SrsState.REVIEW,
        stability=stability,
        difficulty=difficulty,
        last_review=last_review,
        priority_position=None,
        reviews=_reviews_for(index, SrsState.REVIEW, now),
        history=_history_for(index, SrsState.REVIEW, item.due, last_review, item.created_at, stability, difficulty),
    )


def build_fixture(now: datetime) -> AcceptanceFixture:
    """Build the acceptance data plan relative to `now`.

    Args:
        now: The instant the runbook applies the fixture; every seed time is
            derived from it, so the plan stays relevant on any run day.

    Returns:
        The dictionary entries, study items, readings and stroke cache to write.
    """
    return AcceptanceFixture(
        study_items=_with_detail_rows(now),
        dictionary_only=_DICTIONARY_ONLY,
        readings=_build_readings(now),
        strokes=_build_strokes(),
    )


def _with_detail_rows(now: datetime) -> tuple[StudyItemRow, ...]:
    rows = []
    for index, word in enumerate(_WORDS):
        row = _build_item(word, index, now)
        if word.simplified == DETAIL_WORD:
            rows.append(_with_detail_trajectory(row, now))
        elif word.simplified == _DETAIL_NEIGHBOUR:
            rows.append(_with_detail_neighbour(row, now))
        else:
            rows.append(row)
    return tuple(rows)


def _entry_entity(row: DictionaryRow) -> DictionaryEntryEntity:
    return DictionaryEntryEntity(
        simplified=row.simplified,
        pinyin=row.pinyin,
        definitions=list(row.definitions),
        hsk_level=row.hsk_level,
        pos_tags=list(row.pos_tags),
    )


def _item_entity(row: StudyItemRow, entry_id: int) -> StudyItemEntity:
    return StudyItemEntity(
        entry_id=entry_id,
        card_state=int(row.state),
        card_stability=row.stability,
        card_difficulty=row.difficulty,
        card_due=naive_utc(row.due),
        card_last_review=naive_utc(row.last_review) if row.last_review is not None else None,
        created_at=naive_utc(row.created_at),
    )


def _review_entities(row: StudyItemRow, study_item_id: int) -> list[ReviewLogEntity]:
    return [
        ReviewLogEntity(
            study_item_id=study_item_id,
            rating=int(review.rating),
            review_datetime=naive_utc(review.reviewed_at),
        )
        for review in row.reviews
    ]


def _history_entities(row: StudyItemRow, study_item_id: int, entry_id: int) -> list[StudyItemHistoryEntity]:
    return [
        StudyItemHistoryEntity(
            study_item_id=study_item_id,
            created_at=naive_utc(snapshot.recorded_at),
            entry_id=entry_id,
            card_state=int(snapshot.state),
            card_stability=snapshot.stability,
            card_difficulty=snapshot.difficulty,
            card_due=naive_utc(snapshot.due),
            card_last_review=naive_utc(snapshot.last_review) if snapshot.last_review is not None else None,
        )
        for snapshot in row.history
    ]


def _reading_entity(row: ReadingRow) -> ReadingTextEntity:
    chosen = GenerationAttempt(
        text="".join(token.text for token in row.tokens),
        segmentation=tuple(token.text for token in row.tokens if isinstance(token, ReadingWord)),
        extra_words=tuple(token.text for token in row.tokens if isinstance(token, ReadingWord) and token.is_extra),
        prompt_tokens=0,
        completion_tokens=0,
        chosen=True,
    )
    request = ReadingRequest(format=row.format, max_extra_words=2, model=row.model, topic=row.topic)
    reading = GeneratedReading(
        format=row.format,
        tokens=row.tokens,
        known_word_count=_KNOWN_WORD_COUNT,
        attempts=(chosen,),
        speakers=row.speakers,
    )
    return to_entity(request, reading, row.created_at)


def _stroke_entity(row: StrokesRow) -> CharacterStrokesEntity:
    return CharacterStrokesEntity(
        character=row.character,
        has_data=True,
        strokes=list(row.strokes),
        medians=[[list(point) for point in stroke] for stroke in row.medians],
    )


async def apply_acceptance_fixture(settings: Settings, *, now: datetime | None = None) -> SeedOutcome:
    """Write the fixture unless the dictionary already has rows.

    Args:
        settings: The service settings supplying the MySQL URL.
        now: Optional fixed instant for tests; defaults to the current UTC time.

    Returns:
        The written counts, or `seeded=False` when the database already holds
        dictionary data and the run was skipped.
    """
    fixture = build_fixture(now or datetime.now(UTC))
    engine = create_async_engine(settings.mysql.url)
    session_factory = build_session_factory(engine)
    try:
        async with session_factory() as session, session.begin():
            existing = await session.scalar(select(func.count()).select_from(DictionaryEntryEntity))
            if existing:
                _log.info("acceptance.seed.skipped", existing=int(existing))
                return SeedOutcome(seeded=False, dictionary_entries=0, study_items=0, readings=0, strokes=0)

            entry_rows = tuple(item.entry for item in fixture.study_items) + fixture.dictionary_only
            entries = {id(row): _entry_entity(row) for row in entry_rows}
            session.add_all(entries.values())
            await session.flush()

            items = {id(row): _item_entity(row, entries[id(row.entry)].id) for row in fixture.study_items}
            session.add_all(items.values())
            await session.flush()

            for row in fixture.study_items:
                item = items[id(row)]
                session.add_all(_review_entities(row, item.id))
                session.add_all(_history_entities(row, item.id, item.entry_id))
                if row.priority_position is not None:
                    session.add(StudyItemPriorityEntity(study_item_id=item.id, position=row.priority_position))

            session.add_all(_reading_entity(row) for row in fixture.readings)
            session.add_all(_stroke_entity(row) for row in fixture.strokes)

            outcome = SeedOutcome(
                seeded=True,
                dictionary_entries=len(entries),
                study_items=len(items),
                readings=len(fixture.readings),
                strokes=len(fixture.strokes),
            )
            _log.info(
                "acceptance.seed.finished",
                dictionary_entries=outcome.dictionary_entries,
                study_items=outcome.study_items,
                readings=outcome.readings,
                strokes=outcome.strokes,
            )
            return outcome
    finally:
        await engine.dispose()


def main() -> None:
    """Apply the fixture with the process environment's settings."""
    outcome = asyncio.run(apply_acceptance_fixture(Settings()))
    _log.info(
        "acceptance.seed",
        seeded=outcome.seeded,
        dictionary_entries=outcome.dictionary_entries,
        study_items=outcome.study_items,
        readings=outcome.readings,
        strokes=outcome.strokes,
    )


if __name__ == "__main__":
    main()
