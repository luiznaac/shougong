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
