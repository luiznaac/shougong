import type { SrsRating } from "../api/types.ts";

/** One grade key in the practice dock. */
export interface PracticeGrade {
  key: SrsRating;
  label: string;
  hotkey: string;
  /** the interval the note sends the card toward */
  hint: string;
  /** 4px left bar in the note's SRS stage hue */
  barClass: string;
  /** the whole key once it is chosen */
  fillClass: string;
}

/**
 * The four notes in travel order, on the SRS stage ramp: Errei sends the card
 * back to apprentice, Fácil pushes it toward enlightened. The hues are the
 * existing `--color-srs-*` tokens, never the pinyin tones.
 */
export const PRACTICE_GRADES: PracticeGrade[] = [
  {
    key: "again",
    label: "Errei",
    hotkey: "1",
    hint: "reaprende agora",
    barClass: "border-srs-apprentice",
    fillClass: "bg-srs-apprentice",
  },
  {
    key: "hard",
    label: "Difícil",
    hotkey: "2",
    hint: "volta em ~1 dia",
    barClass: "border-srs-guru",
    fillClass: "bg-srs-guru",
  },
  {
    key: "good",
    label: "Bom",
    hotkey: "3",
    hint: "volta em ~3 dias",
    barClass: "border-srs-master",
    fillClass: "bg-srs-master",
  },
  {
    key: "easy",
    label: "Fácil",
    hotkey: "4",
    hint: "volta em ~7 dias",
    barClass: "border-srs-enlightened",
    fillClass: "bg-srs-enlightened",
  },
];

const BY_RATING = Object.fromEntries(PRACTICE_GRADES.map((grade) => [grade.key, grade])) as Record<
  SrsRating,
  PracticeGrade
>;

export function gradeOf(rating: SrsRating): PracticeGrade {
  return BY_RATING[rating];
}

export function gradeByHotkey(hotkey: string): PracticeGrade | undefined {
  return PRACTICE_GRADES.find((grade) => grade.hotkey === hotkey);
}

/** The revealed middle's consequence line, e.g. "Bom · volta em ~3 dias". */
export function gradeConsequence(rating: SrsRating): string {
  const grade = gradeOf(rating);
  return `${grade.label} · ${grade.hint}`;
}
