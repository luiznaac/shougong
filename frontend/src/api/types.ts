// Mirrors shougong's httpapi/schema.py response DTOs.

export type SrsRating = "again" | "hard" | "good" | "easy";
export type SrsState = "learning" | "review" | "relearning";

export interface DictionaryEntry {
  id: number;
  simplified: string;
  pinyin: string; // numbered, space-separated, e.g. "zhi1 dao4"
  definitions: string[];
}

export interface CharacterStrokes {
  character: string;
  strokes: string[]; // SVG path 'd' strings, in drawing order
  medians: number[][][]; // per stroke: [x, y] points, raw hanzi-writer-data
  // coordinate space (1024x1024 box, Y-axis flipped — see StrokeOrder.tsx)
}

export interface SrsCard {
  state: SrsState;
  due: string; // ISO
  stability: number | null;
  difficulty: number | null;
  last_review: string | null;
}

export interface StudyItem {
  id: number;
  entry: DictionaryEntry;
  card: SrsCard;
  created_at: string;
}

export interface ReviewLog {
  rating: SrsRating;
  review_datetime: string;
}

export interface BatchImportRowRequest {
  hanzi: string;
  pinyin: string; // numbered tones, e.g. "xue2 xi2"
}

export type BatchRowStatus = "created" | "skipped" | "error";

export interface BatchImportOutcome {
  row: number; // 1-based position in the submitted list
  hanzi: string;
  pinyin: string;
  status: BatchRowStatus;
  study_item_id: number | null;
  detail: string | null;
  // populated when `status` is "error" and more than one dictionary entry
  // matched: pick one and POST it to /study-items to resolve the row.
  candidates: DictionaryEntry[];
}

export interface BatchImportResponse {
  created: number;
  skipped: number;
  errors: number;
  outcomes: BatchImportOutcome[];
}

export interface ReviewResult {
  item: StudyItem;
  review: ReviewLog;
}

/**
 * A snapshot of a study item's state at one moment — written when the item is
 * created and after every change. `created_at` is when the row was written, not
 * the study item's own creation time. Returned newest first.
 */
export interface StudyItemHistory {
  study_item_id: number;
  entry: DictionaryEntry;
  card: SrsCard;
  created_at: string;
}

export type ReadingFormat = "paragraph" | "sentences";

// Grammatical class of a word, from the backend's own vocabulary (English) —
// translate for display via ../i18n/partOfSpeech.ts, never show this raw.
export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "pronoun"
  | "numeral"
  | "quantifier"
  | "preposition"
  | "conjunction"
  | "particle"
  | "other";

export interface GenerateReadingRequest {
  format: ReadingFormat;
  max_extra_words: number;
  // LiteLLM model id, chosen on the reading screen from GET /reading-texts/models.
  // Always sent — there is no server-side default model.
  model: string;
  topic?: string | null;
}

// One segmented token of a generated reading — a word (pinyin/definitions/part
// of speech from the app's own dictionary, never from the LLM) or a punctuation
// token passed through as-is (`is_word: false`, the other fields unused).
export interface ReadingToken {
  text: string;
  is_word: boolean;
  pinyin: string | null;
  definitions: string[];
  part_of_speech: PartOfSpeech | null;
  is_extra: boolean;
  // Populated whenever a dictionary entry was resolved (including for extra
  // words) — lets an extra word be added straight to the study queue.
  dictionary_entry_id: number | null;
}

// One draft the model produced on the way to the final text — kept even when
// discarded, so the correction loop leaves an auditable trail.
export interface ReadingAttempt {
  attempt: number; // 1-based position in the trail
  text: string;
  segmentation: string[]; // the segmenter's raw tokens for this draft
  extra_words: string[]; // words the validator flagged as outside known_words
  prompt_tokens: number;
  completion_tokens: number;
  chosen: boolean; // exactly one attempt became the reading
}

// Broad grammatical class of a known word, from the backend's own taxonomy.
export type VocabularyCategory =
  | "verb"
  | "noun"
  | "person"
  | "place"
  | "qualifier"
  | "adverb"
  | "time"
  | "quantity"
  | "connective"
  | "pronoun"
  | "functional"
  | "other";

export interface VocabularyProfile {
  simplified: string;
  hsk_level: number | null;
  pos_tags: string[];
  pos_category: VocabularyCategory;
  source: "hsk" | "manual" | "unknown";
  pinyin: string | null;
  gloss: string | null;
}

export interface Proficiency {
  coverage_by_level: Record<string, number>; // known / HSK-dataset total per level, 0..1
  estimated_level: number; // highest HSK level mastered contiguously (0 = pure beginner)
}

export interface VocabularySummary {
  total: number;
  categorised: number;
  by_category: Record<string, number>;
  by_hsk_level: Record<string, number>; // keyed by str(level) or "none"
  qualifier_shortage: boolean;
  proficiency: Proficiency;
}

export interface VocabularyOverview {
  profiles: VocabularyProfile[];
  summary: VocabularySummary;
}

export interface ReadingTopic {
  id: number;
  scenario: string;
  active: boolean; // inactive scenarios stay in the list but are not drawn
}

export interface SavedReadingText {
  id: number;
  format: ReadingFormat;
  max_extra_words: number;
  // LiteLLM model that generated this text ("" for rows saved before model choice existed).
  model: string;
  topic: string | null;
  topic_generated: boolean; // true → the code drew the topic from the scenario list
  tokens: ReadingToken[];
  // Size of the known-vocabulary set (the study queue) sent to the model.
  known_word_count: number;
  // Full generation trail, plus figures derived from it. `attempts` is empty and
  // `attempt_count` is 1 for rows saved before the correction loop existed.
  attempts: ReadingAttempt[];
  attempt_count: number;
  extra_words: string[]; // of the chosen draft
  prompt_tokens: number; // summed across attempts
  completion_tokens: number;
  // The vocabulary offered to the model for this generation (group label -> words)
  // and its anchor words. Empty for rows saved before working sets existed.
  working_set: Record<string, string[]>;
  must_use: string[];
  created_at: string;
}
