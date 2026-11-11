// Throwaway prototype session state (wayfinder ticket #111). The runner's state
// machine, shared by every variant so only the layout differs: info → prompt →
// revealed → grade, with rollback and the 1–4 / Backspace / Enter shortcuts
// behaving exactly like the production Quiz. Nothing is persisted or sent.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SrsRating } from "../../api/types.ts";
import { HOTKEY_RATING, type MockQuizItem, type PracticeMode, QUEUE } from "./practiceData.ts";

export type Phase = "info" | "prompt" | "revealed";

export const PHASE_QUESTION: Record<Phase, string> = {
  info: "Estude o item",
  prompt: "Escreva o caractere à mão",
  revealed: "Você acertou a escrita?",
};

export const PHASE_NEXT: Record<Phase, string> = {
  info: "Continuar",
  prompt: "Revelar",
  revealed: "Próximo",
};

export interface PracticeSession {
  mode: PracticeMode;
  items: MockQuizItem[];
  item: MockQuizItem | undefined;
  index: number;
  phase: Phase;
  selected: SrsRating | null;
  grades: SrsRating[];
  done: number;
  correct: number;
  accuracy: number;
  remaining: number;
  finished: boolean;
  handwriting: boolean;
  toast: string | null;
  canRollback: boolean;
  canNext: boolean;
  setHandwriting: (on: boolean) => void;
  select: (rating: SrsRating) => void;
  next: () => void;
  rollback: () => void;
  restart: () => void;
}

export function usePracticeSession(mode: PracticeMode): PracticeSession {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(mode === "lesson" ? "info" : "prompt");
  const [selected, setSelected] = useState<SrsRating | null>(null);
  const [grades, setGrades] = useState<SrsRating[]>([]);
  const [handwriting, setHandwriting] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const item = QUEUE[index];
  const finished = index >= QUEUE.length;
  const done = grades.length;
  const correct = grades.filter((g) => g !== "again").length;
  const accuracy = done > 0 ? Math.round((correct / done) * 100) : 100;
  const canRollback = phase === "revealed" || (phase === "prompt" && mode === "lesson");
  const canNext = phase !== "revealed" || selected != null;

  const next = useCallback(() => {
    if (phase === "info") return setPhase("prompt");
    if (phase === "prompt") return setPhase("revealed");
    if (!selected) {
      setToast("Escolha uma nota antes de avançar");
      return;
    }
    setGrades((g) => [...g, selected]);
    setSelected(null);
    setPhase(mode === "lesson" ? "info" : "prompt");
    setIndex((i) => i + 1);
  }, [phase, selected, mode]);

  const rollback = useCallback(() => {
    if (phase === "revealed") {
      if (selected) return setSelected(null);
      return setPhase("prompt");
    }
    if (phase === "prompt" && mode === "lesson") setPhase("info");
  }, [phase, selected, mode]);

  const restart = useCallback(() => {
    setIndex(0);
    setPhase(mode === "lesson" ? "info" : "prompt");
    setSelected(null);
    setGrades([]);
    setToast(null);
  }, [mode]);

  const stateRef = useRef({ phase, canRollback });
  stateRef.current = { phase, canRollback };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = stateRef.current;
      if (e.key === "Escape") {
        setToast("Esc — no app, sai para o painel");
        return;
      }
      if ((e.key === "Backspace" || e.key === "z") && s.canRollback) {
        e.preventDefault();
        return rollback();
      }
      if (s.phase === "revealed") {
        const hit = HOTKEY_RATING[e.key];
        if (hit) {
          e.preventDefault();
          return setSelected(hit);
        }
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        void next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, rollback]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  return {
    mode,
    items: QUEUE,
    item,
    index,
    phase,
    selected,
    grades,
    done,
    correct,
    accuracy,
    remaining: QUEUE.length - index,
    finished,
    handwriting,
    toast,
    canRollback,
    canNext,
    setHandwriting,
    select: setSelected,
    next,
    rollback,
    restart,
  };
}
