"""Transport DTOs. Pydantic lives here, at the edge — never in `usecase`."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.health.checker import HealthCheckResult
from shougong.usecase.reading.model import (
    GenerationAttempt,
    ReadingFormat,
    ReadingRequest,
    ReadingToken,
    ReadingTopic,
    ReadingWord,
    SavedReadingText,
)
from shougong.usecase.reading.vocabulary import (
    VocabularySummary,
    VocabularyWord,
)
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog
from shougong.usecase.strokes.model import CharacterStrokes
from shougong.usecase.study.model import BatchImportOutcome, BatchImportReport, ReviewResult, StudyItem
from shougong.usecase.study_item_history.model import StudyItemHistory


class HealthCheckResponse(BaseModel):
    service_name: str
    is_healthy: bool
    timestamp: datetime

    @classmethod
    def from_domain(cls, result: HealthCheckResult) -> HealthCheckResponse:
        return cls(
            service_name=result.service_name,
            is_healthy=result.is_healthy,
            timestamp=result.timestamp,
        )


class DictionaryEntryResponse(BaseModel):
    id: int
    simplified: str
    pinyin: str
    definitions: list[str]
    hsk_level: int | None
    pos_tags: list[str]

    @classmethod
    def from_domain(cls, entry: DictionaryEntry) -> DictionaryEntryResponse:
        return cls(
            id=entry.id,
            simplified=entry.simplified,
            pinyin=entry.pinyin,
            definitions=list(entry.definitions),
            hsk_level=entry.hsk_level,
            pos_tags=list(entry.pos_tags),
        )


class CharacterStrokesResponse(BaseModel):
    character: str
    strokes: list[str]
    medians: list[list[list[float]]]

    @classmethod
    def from_domain(cls, strokes: CharacterStrokes) -> CharacterStrokesResponse:
        return cls(
            character=strokes.character,
            strokes=list(strokes.strokes),
            medians=[[list(pt) for pt in stroke] for stroke in strokes.medians],
        )


class SrsCardResponse(BaseModel):
    state: str
    due: datetime
    stability: float | None
    difficulty: float | None
    last_review: datetime | None

    @classmethod
    def from_domain(cls, card: SrsCard) -> SrsCardResponse:
        return cls(
            state=card.state.name.lower(),
            due=card.due,
            stability=card.stability,
            difficulty=card.difficulty,
            last_review=card.last_review,
        )


class StudyItemResponse(BaseModel):
    id: int
    entry: DictionaryEntryResponse
    card: SrsCardResponse
    created_at: datetime

    @classmethod
    def from_domain(cls, item: StudyItem) -> StudyItemResponse:
        return cls(
            id=item.id,
            entry=DictionaryEntryResponse.from_domain(item.entry),
            card=SrsCardResponse.from_domain(item.card),
            created_at=item.created_at,
        )


class AddStudyItemRequest(BaseModel):
    dictionary_entry_id: int


class BatchImportRowRequest(BaseModel):
    hanzi: str
    pinyin: str = ""


class BatchImportRequest(BaseModel):
    rows: list[BatchImportRowRequest] = Field(min_length=1, max_length=1000)


class BatchImportOutcomeResponse(BaseModel):
    row: int
    hanzi: str
    pinyin: str
    status: str  # "created" | "skipped" | "error"
    study_item_id: int | None
    detail: str | None
    # populated when `status` is "error" and more than one dictionary entry matched:
    # pick one and POST it to /study-items to resolve the row.
    candidates: list[DictionaryEntryResponse] = Field(default_factory=list)

    @classmethod
    def from_domain(cls, outcome: BatchImportOutcome) -> BatchImportOutcomeResponse:
        return cls(
            row=outcome.row,
            hanzi=outcome.hanzi,
            pinyin=outcome.pinyin,
            status=outcome.status.value,
            study_item_id=outcome.study_item_id,
            detail=outcome.detail,
            candidates=[DictionaryEntryResponse.from_domain(entry) for entry in outcome.candidates],
        )


class BatchImportResponse(BaseModel):
    created: int
    skipped: int
    errors: int
    outcomes: list[BatchImportOutcomeResponse]

    @classmethod
    def from_domain(cls, report: BatchImportReport) -> BatchImportResponse:
        outcomes = [BatchImportOutcomeResponse.from_domain(o) for o in report.outcomes]
        return cls(
            created=sum(1 for o in outcomes if o.status == "created"),
            skipped=sum(1 for o in outcomes if o.status == "skipped"),
            errors=sum(1 for o in outcomes if o.status == "error"),
            outcomes=outcomes,
        )


class ReviewRequest(BaseModel):
    rating: Literal["again", "hard", "good", "easy"]

    def to_domain(self) -> SrsRating:
        return SrsRating[self.rating.upper()]


class ReviewLogResponse(BaseModel):
    rating: str
    review_datetime: datetime

    @classmethod
    def from_domain(cls, log: SrsReviewLog) -> ReviewLogResponse:
        return cls(rating=log.rating.name.lower(), review_datetime=log.review_datetime)


class StudyItemHistoryResponse(BaseModel):
    study_item_id: int
    entry: DictionaryEntryResponse
    card: SrsCardResponse
    created_at: datetime

    @classmethod
    def from_domain(cls, history: StudyItemHistory) -> StudyItemHistoryResponse:
        return cls(
            study_item_id=history.study_item_id,
            entry=DictionaryEntryResponse.from_domain(history.entry),
            card=SrsCardResponse.from_domain(history.card),
            created_at=history.created_at,
        )


class ReviewResponse(BaseModel):
    item: StudyItemResponse
    review: ReviewLogResponse

    @classmethod
    def from_domain(cls, result: ReviewResult) -> ReviewResponse:
        return cls(
            item=StudyItemResponse.from_domain(result.item),
            review=ReviewLogResponse.from_domain(result.log),
        )


class GenerateReadingRequest(BaseModel):
    format: Literal["paragraph", "sentences", "dialogue"] = "paragraph"
    max_extra_words: int = Field(default=2, ge=0, le=20)
    # Correction-loop rounds allowed before the least-bad draft is kept.
    max_attempts: int = Field(default=3, ge=1, le=6)
    # LiteLLM model id chosen on the reading screen from GET /reading-texts/models;
    # always sent by the client — there is no server-side default model.
    model: str = Field(min_length=1, max_length=128)
    # Free text sent verbatim to the LLM prompt — bounded to keep injected
    # instructions short; the system prompt also tells the model to treat this
    # field as a literal topic, never as instructions (see LiteLlmReadingGateway).
    topic: str | None = Field(default=None, max_length=200)

    def to_domain(self) -> ReadingRequest:
        return ReadingRequest(
            format=ReadingFormat(self.format),
            max_extra_words=self.max_extra_words,
            model=self.model,
            topic=self.topic,
            max_attempts=self.max_attempts,
        )


class ReadingTokenResponse(BaseModel):
    text: str
    is_word: bool
    pinyin: str | None
    definitions: list[str]
    part_of_speech: str | None
    is_extra: bool
    # Populated whenever a dictionary entry was resolved (including for extra
    # words) — lets the frontend add an extra word to the study queue directly
    # from the reading (`POST /study-items`).
    dictionary_entry_id: int | None
    speaker: str | None  # set only for dialogue tokens

    @classmethod
    def from_domain(cls, token: ReadingToken) -> ReadingTokenResponse:
        if isinstance(token, ReadingWord):
            return cls(
                text=token.text,
                is_word=True,
                pinyin=token.pinyin,
                definitions=list(token.definitions),
                part_of_speech=token.part_of_speech.value if token.part_of_speech is not None else None,
                is_extra=token.is_extra,
                dictionary_entry_id=token.dictionary_entry_id,
                speaker=token.speaker,
            )
        return cls(
            text=token.text,
            is_word=False,
            pinyin=None,
            definitions=[],
            part_of_speech=None,
            is_extra=False,
            dictionary_entry_id=None,
            speaker=token.speaker,
        )


class ReadingSpeakerResponse(BaseModel):
    name: str
    pinyin: str | None  # shown to the learner on first use; None for known role words


class ReadingAttemptResponse(BaseModel):
    attempt: int  # 1-based position in the generation trail
    text: str
    segmentation: list[str]  # the segmenter's raw tokens for this draft
    extra_words: list[str]  # words the validator flagged as outside known_words
    prompt_tokens: int
    completion_tokens: int
    chosen: bool  # exactly one attempt is the one that became the reading
    dialogue_problems: list[str]  # turn-structure issues found in this draft

    @classmethod
    def from_domain(cls, index: int, attempt: GenerationAttempt) -> ReadingAttemptResponse:
        return cls(
            attempt=index + 1,
            text=attempt.text,
            segmentation=list(attempt.segmentation),
            extra_words=list(attempt.extra_words),
            prompt_tokens=attempt.prompt_tokens,
            completion_tokens=attempt.completion_tokens,
            chosen=attempt.chosen,
            dialogue_problems=list(attempt.dialogue_problems),
        )


class SavedReadingTextResponse(BaseModel):
    id: int
    format: str
    max_extra_words: int
    max_attempts: int  # correction-loop budget the caller allowed (3 on old rows)
    model: str  # LiteLLM model that generated this text ("" for rows saved before model choice existed)
    topic: str | None
    topic_generated: bool  # True when the code drew the topic from the scenario list
    tokens: list[ReadingTokenResponse]
    known_word_count: int
    # Generation outcome: the full trail of drafts, plus figures derived from it.
    attempts: list[ReadingAttemptResponse]
    attempt_count: int  # 1 for rows saved before the correction loop existed
    extra_words: list[str]  # of the chosen draft; falls back to flagged tokens on old rows
    prompt_tokens: int
    completion_tokens: int
    # The vocabulary offered to the model for this generation ({group: [words]})
    # and its anchor words. Empty on rows saved before working sets existed.
    working_set: dict[str, list[str]]
    must_use: list[str]
    speakers: list[ReadingSpeakerResponse]  # non-empty only for dialogue readings
    created_at: datetime

    @classmethod
    def from_domain(cls, saved: SavedReadingText) -> SavedReadingTextResponse:
        reading = saved.reading
        extra_words = list(reading.extra_words) or sorted(
            {t.text for t in reading.tokens if isinstance(t, ReadingWord) and t.is_extra}
        )
        return cls(
            id=saved.id,
            format=saved.request.format.value,
            max_extra_words=saved.request.max_extra_words,
            max_attempts=saved.request.max_attempts,
            model=saved.request.model,
            topic=saved.request.topic,
            topic_generated=saved.request.topic_generated,
            tokens=[ReadingTokenResponse.from_domain(t) for t in reading.tokens],
            known_word_count=reading.known_word_count,
            attempts=[ReadingAttemptResponse.from_domain(i, a) for i, a in enumerate(reading.attempts)],
            attempt_count=reading.attempt_count,
            extra_words=extra_words,
            prompt_tokens=reading.prompt_tokens,
            completion_tokens=reading.completion_tokens,
            working_set={group: list(words) for group, words in reading.working_set.items()},
            must_use=list(reading.must_use),
            speakers=[ReadingSpeakerResponse(name=s.name, pinyin=s.pinyin) for s in reading.speakers],
            created_at=saved.created_at,
        )


class VocabularyWordResponse(BaseModel):
    simplified: str
    hsk_level: int | None
    pos_tags: list[str]
    pos_categories: list[str]  # every grammatical class the word's tags imply
    pinyin: str | None
    gloss: str | None

    @classmethod
    def from_domain(cls, word: VocabularyWord) -> VocabularyWordResponse:
        return cls(
            simplified=word.simplified,
            hsk_level=word.hsk_level,
            pos_tags=list(word.pos_tags),
            pos_categories=sorted(category.value for category in word.pos_categories),
            pinyin=word.pinyin,
            gloss=word.gloss,
        )


class ProficiencyResponse(BaseModel):
    coverage_by_level: dict[str, float]  # known / dataset total per HSK level, 0..1
    estimated_level: int  # highest HSK level mastered contiguously (0 = pure beginner)


class VocabularySummaryResponse(BaseModel):
    total: int
    categorised: int
    by_category: dict[str, int]
    by_hsk_level: dict[str, int]
    qualifier_shortage: bool
    proficiency: ProficiencyResponse

    @classmethod
    def from_domain(cls, summary: VocabularySummary) -> VocabularySummaryResponse:
        return cls(
            total=summary.total,
            categorised=summary.categorised,
            by_category=summary.by_category,
            by_hsk_level=summary.by_hsk_level,
            qualifier_shortage=summary.qualifier_shortage,
            proficiency=ProficiencyResponse(
                coverage_by_level={str(level): cov for level, cov in summary.proficiency.coverage_by_level.items()},
                estimated_level=summary.proficiency.estimated_level,
            ),
        )


class VocabularyOverviewResponse(BaseModel):
    profiles: list[VocabularyWordResponse]
    summary: VocabularySummaryResponse


class ReadingTopicResponse(BaseModel):
    id: int
    scenario: str
    active: bool

    @classmethod
    def from_domain(cls, topic: ReadingTopic) -> ReadingTopicResponse:
        return cls(id=topic.id, scenario=topic.scenario, active=topic.active)


class AddReadingTopicRequest(BaseModel):
    scenario: str = Field(min_length=1, max_length=255)


class SetReadingTopicActiveRequest(BaseModel):
    active: bool
