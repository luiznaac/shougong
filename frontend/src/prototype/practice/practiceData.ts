// Throwaway prototype data (wayfinder ticket #111 — Lesson, Review and Practice).
// Mirrors GET /study-sessions item shapes with a short queue; no API calls.

import type { SrsRating, SrsState } from "../../api/types.ts";

export type PracticeMode = "lesson" | "review" | "practice";

export interface MockQuizItem {
  id: number;
  simplified: string;
  pinyin: string; // numbered, e.g. "xue2 xi2"
  definitions: string[];
  hsk_level: number | null;
  state: SrsState;
  is_leech: boolean;
}

export const QUEUE: MockQuizItem[] = [
  {
    id: 7,
    simplified: "学习",
    pinyin: "xue2 xi2",
    definitions: ["to study", "to learn"],
    hsk_level: 1,
    state: "learning",
    is_leech: false,
  },
  {
    id: 18,
    simplified: "汉字",
    pinyin: "han4 zi4",
    definitions: ["Chinese characters", "Han character"],
    hsk_level: 2,
    state: "review",
    is_leech: false,
  },
  {
    id: 31,
    simplified: "图书馆",
    pinyin: "tu2 shu1 guan3",
    definitions: ["library"],
    hsk_level: 3,
    state: "review",
    is_leech: true,
  },
  {
    id: 44,
    simplified: "舒服",
    pinyin: "shu1 fu5",
    definitions: ["comfortable", "at ease"],
    hsk_level: 4,
    state: "relearning",
    is_leech: false,
  },
];

export interface ModeMeta {
  key: PracticeMode;
  /** top-bar label, same copy the runner uses today */
  eyebrow: string;
  /** coloured subject band */
  band: string;
  /** tinted chip for mode badges and rails */
  chip: string;
}

export const MODES: Record<PracticeMode, ModeMeta> = {
  lesson: {
    key: "lesson",
    eyebrow: "Lição",
    band: "from-violet-600 to-violet-800",
    chip: "bg-violet-500/15 text-violet-200 ring-violet-400/30",
  },
  review: {
    key: "review",
    eyebrow: "Review",
    band: "from-rose-500 to-accent-600",
    chip: "bg-rose-500/15 text-rose-200 ring-rose-400/30",
  },
  practice: {
    key: "practice",
    eyebrow: "Prática",
    band: "from-cyan-600 to-sky-800",
    chip: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/30",
  },
};

export const RATING_TONE: Record<SrsRating, string> = {
  again: "bg-rose-500",
  hard: "bg-amber-500",
  good: "bg-emerald-500",
  easy: "bg-sky-500",
};

export const RATING_TEXT: Record<SrsRating, string> = {
  again: "text-rose-300",
  hard: "text-amber-300",
  good: "text-emerald-300",
  easy: "text-sky-300",
};

export const GRADES: {
  key: SrsRating;
  label: string;
  hotkey: string;
  hint: string;
  bg: string;
}[] = [
  { key: "again", label: "Errei", hotkey: "1", hint: "reaprende agora", bg: "bg-rose-600" },
  { key: "hard", label: "Difícil", hotkey: "2", hint: "volta em ~1 dia", bg: "bg-amber-600" },
  { key: "good", label: "Bom", hotkey: "3", hint: "volta em ~3 dias", bg: "bg-emerald-600" },
  { key: "easy", label: "Fácil", hotkey: "4", hint: "volta em ~7 dias", bg: "bg-sky-600" },
];

export const HOTKEY_RATING: Record<string, SrsRating> = Object.fromEntries(
  GRADES.map((g) => [g.hotkey, g.key]),
);
