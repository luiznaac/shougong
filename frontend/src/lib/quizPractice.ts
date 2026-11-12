import type { SrsRating } from "../api/types.ts";

export type QuizMode = "lesson" | "review";

export type QuizPhase = "info" | "prompt" | "revealed";

/** The question strip's copy for the current phase. */
export const QUESTION_LABEL: Record<QuizPhase, string> = {
  info: "Estude o item",
  prompt: "Escreva o caractere à mão",
  revealed: "Você acertou a escrita?",
};

/** The advance button's label for the current phase. */
export const NEXT_LABEL: Record<QuizPhase, string> = {
  info: "Continuar",
  prompt: "Revelar",
  revealed: "Próximo",
};

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

/** The practice stage's coloured band: one identity per mode, practice on cyan. */
export function stageBandClass(mode: QuizMode, record: boolean): string {
  if (!record) return "from-cyan-600 to-sky-800";
  return mode === "lesson" ? "from-violet-600 to-violet-800" : "from-rose-500 to-accent-600";
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
