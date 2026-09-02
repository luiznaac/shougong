// Mirrors shougong's httpapi/schema.py response DTOs.

export type SrsRating = "again" | "hard" | "good" | "easy";
export type SrsState = "learning" | "review" | "relearning";

export interface DictionaryEntry {
  id: number;
  simplified: string;
  pinyin: string; // numbered, space-separated, e.g. "zhi1 dao4"
  definitions: string[];
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

export interface ReviewResult {
  item: StudyItem;
  review: ReviewLog;
}
