import type { SrsRating } from "../api/types.ts";

export type QuizMode = "lesson" | "review";

export interface QuizSummaryCopy {
  title: string;
  note: string | null;
  doneLabel: string;
}

export interface GradeRequest {
  id: number;
  rating: SrsRating;
}

export function topBarTitle(mode: QuizMode, record: boolean): string {
  if (!record) return "Prática";
  return mode === "lesson" ? "Lição" : "Review";
}

export function summaryCopy(mode: QuizMode, record: boolean): QuizSummaryCopy {
  if (!record) {
    return {
      title: "Prática concluída 🎉",
      note: "Nada foi registrado — seu SRS está intacto.",
      doneLabel: "Praticados",
    };
  }
  return {
    title: mode === "lesson" ? "Lição concluída 🎉" : "Sessão concluída 🎉",
    note: null,
    doneLabel: mode === "lesson" ? "Aprendidos" : "Revisados",
  };
}

/**
 * The only place a revealed-phase advance decides whether to write. Practice
 * (`record: false`) never calls `submit`, so the runner issues no grade request
 * at all — the guarantee is the missing call, not a backend flag.
 */
export async function submitRevealedGrade({
  record,
  itemId,
  rating,
  submit,
}: {
  record: boolean;
  itemId: number;
  rating: SrsRating;
  submit: (grade: GradeRequest) => Promise<unknown>;
}): Promise<void> {
  if (record) await submit({ id: itemId, rating });
}
