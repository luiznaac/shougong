import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client.ts";
import { useCharacterStrokes, useReviewMutation } from "../api/queries.ts";
import type { SrsRating, StudyItem } from "../api/types.ts";
import { handwritingCanvasCap } from "../lib/handwriting.ts";
import { useAutoReveal, useHandwritingEnabled } from "../lib/localSettings.ts";
import { PATHS, itemPath } from "../lib/navigation.ts";
import { gradeByHotkey, gradeConsequence } from "../lib/practiceGrades.ts";
import {
  NEXT_LABEL,
  type QuizMode,
  type QuizPhase,
  questionLabel,
  stageBandClass,
  submitRevealedGrade,
  summaryCopy,
  topBarTitle,
} from "../lib/quizPractice.ts";
import { STAGE_HORIZONTAL_PADDING } from "../lib/safeArea.ts";
import {
  type SlotCapture,
  afterCharacterComplete,
  revealTarget,
  rollbackStep,
} from "../lib/selfCheck.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";
import { HandwritingQuiz, type HandwritingStepProps } from "./HandwritingQuiz.tsx";
import { PracticeBand } from "./PracticeBand.tsx";
import { PracticeDock } from "./PracticeDock.tsx";
import { SlotRow } from "./SlotRow.tsx";
import { Toast } from "./Toast.tsx";

/**
 * The practice stage shared by Lesson, Review and Practice: one bounded stage
 * on desktop and a full-height flow on mobile. The coloured band carries the
 * header, progress and one glyph per phase; the middle is phase-specific; the
 * dock carries the four grade keys, rollback and advance. Nothing is submitted
 * until "Próximo" confirms a note; rollback clears the note then steps back.
 *
 * `record` defaults to true. Practice passes false, which keeps the whole
 * runner but never issues a write request — there is no grade call at all, so
 * "not recorded" is structural rather than a flag the backend has to honour.
 *
 * The handwriting step is a seam: `HandwritingStep` defaults to `HandwritingQuiz`
 * and its tests inject a double that fires completion, so the flow runs without
 * hanzi-writer.
 */
export function Quiz({
  items,
  mode,
  emptyMessage,
  record = true,
  HandwritingStep = HandwritingQuiz,
}: {
  items: StudyItem[];
  mode: QuizMode;
  emptyMessage: string;
  record?: boolean;
  HandwritingStep?: ComponentType<HandwritingStepProps>;
}) {
  const navigate = useNavigate();
  const { mutateAsync: review } = useReviewMutation();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  const stackHandwriting = useMediaQuery("(max-width: 22rem)");
  const handwritingCap = handwritingCanvasCap(coarsePointer ? "coarse" : "fine");
  const presentation = desktop ? "desktop" : "mobile";

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<QuizPhase>(mode === "lesson" ? "info" : "prompt");
  const [selected, setSelected] = useState<SrsRating | null>(null);
  const [grades, setGrades] = useState<(SrsRating | null)[]>([]);
  const [done, setDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [playerOn, setPlayerOn] = useState(false);
  const [handwritingEnabled, setHandwritingEnabled] = useHandwritingEnabled();
  const [autoReveal] = useAutoReveal();
  const [drawIdx, setDrawIdx] = useState(0);
  const [redrawCount, setRedrawCount] = useState(0);
  const [snapshots, setSnapshots] = useState<(SlotCapture | null)[]>([]);

  const current = items[idx];
  const chars = current ? [...current.entry.simplified] : [];
  // The peek's model comes from the same cached stroke query the handwriting
  // child already used, so it adds no new request beyond the one the child made.
  const { data: peekStrokes } = useCharacterStrokes(phase === "peek" ? (chars[drawIdx] ?? "") : "");
  const remaining = items.length - idx;
  const accuracy = done > 0 ? Math.round((correct / done) * 100) : 100;
  const finished = idx >= items.length;

  const practice = !record;
  const bandClass = stageBandClass(mode, record);

  const advance = useCallback(() => {
    setSelected(null);
    setPlayerOn(false);
    setPhase(mode === "lesson" ? "info" : "prompt");
    setIdx((i) => i + 1);
    setDrawIdx(0);
    setRedrawCount(0);
    setSnapshots([]);
  }, [mode]);

  // Forward: info → prompt → (peek) → revealed → (submit + next). A manual
  // reveal before the last character peeks at just that one; the last
  // character's reveal compares the whole word. On `revealed` the advance only
  // fires once a grade is selected, so it doubles as the answer confirmation.
  const goNext = useCallback(async () => {
    if (submitting || !current) return;
    if (phase === "info") return setPhase("prompt");
    if (phase === "peek") {
      setDrawIdx((i) => i + 1);
      return setPhase("prompt");
    }
    if (phase === "prompt") {
      setSelected(null);
      if (!handwritingEnabled || revealTarget(drawIdx, chars.length) === "whole") {
        return setPhase("revealed");
      }
      return setPhase("peek");
    }
    if (!selected) return;

    setSubmitting(true);
    try {
      await submitRevealedGrade({
        record,
        itemId: current.id,
        rating: selected,
        submit: review,
      });
      setDone((n) => n + 1);
      if (selected !== "again") setCorrect((n) => n + 1);
      setGrades((history) => [...history, selected]);
      advance();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setToast("Item não estava disponível — pulado.");
        setSkipped((n) => n + 1);
        setGrades((history) => [...history, null]);
        advance();
      } else {
        setToast(`Erro ao enviar: ${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    phase,
    selected,
    submitting,
    current,
    advance,
    review,
    record,
    handwritingEnabled,
    drawIdx,
    chars.length,
  ]);

  // What rollback would do right now, derived during render so availability and
  // behaviour read from the same pure rule.
  const rollbackAction = rollbackStep({
    phase,
    hasGrade: selected != null,
    drawIdx,
    count: chars.length,
    lesson: mode === "lesson",
    handwriting: handwritingEnabled,
  });
  const canRollback = rollbackAction.kind !== "unavailable";

  // Backward, in the self-check's order: clear the chosen grade first; with no
  // grade step back one character (redrawing it) into recall; from recall a
  // lesson steps back a character and review/practice have nowhere to go. A
  // peek just returns to the character being drawn.
  const rollback = useCallback(() => {
    if (submitting) return;
    switch (rollbackAction.kind) {
      case "clear-grade":
        return setSelected(null);
      case "step-back":
        setPhase("prompt");
        setDrawIdx(rollbackAction.drawIdx);
        setRedrawCount(0);
        setSnapshots((all) => all.map((s, i) => (i < rollbackAction.drawIdx ? s : null)));
        return;
      case "return-to-recall":
        return setPhase("prompt");
      case "back-to-info":
        setPhase("info");
        setDrawIdx(0);
        setRedrawCount(0);
        setSnapshots([]);
        return;
      case "unavailable":
        return;
    }
  }, [submitting, rollbackAction]);

  // Handwriting self-check: one character at a time. The drawing is never
  // graded — completion just moves to the next character, and the final one
  // reveals with no note chosen, so the learner grades their own attempt. Each
  // completion stores its snapshot (the learner's drawing and the fetched model)
  // so the slot row can hold it during recall and compare it at the reveal. The
  // final character reveals automatically only when the auto-reveal preference
  // is on; off, the learner taps "Revelar" when ready.
  const handleCharComplete = useCallback(
    (snapshot: SlotCapture) => {
      setSnapshots((all) => {
        const next =
          all.length === chars.length ? [...all] : Array.from({ length: chars.length }, () => null);
        next[drawIdx] = snapshot;
        return next;
      });
      const step = afterCharacterComplete(drawIdx, chars.length, autoReveal);
      if (step === "next") setDrawIdx((i) => i + 1);
      if (step === "revealed") {
        setSelected(null);
        setPhase("revealed");
      }
    },
    [drawIdx, chars.length, autoReveal],
  );

  // Clear the character being drawn: bumping the count remounts the writer so
  // its strokes and hint state reset, while earlier characters keep their
  // snapshots in the slot row.
  const clearCurrent = useCallback(() => {
    setSnapshots((all) => all.map((capture, i) => (i === drawIdx ? null : capture)));
    setRedrawCount((count) => count + 1);
  }, [drawIdx]);

  const canGoNext = phase !== "revealed" || selected != null;
  const awaitingReveal =
    phase === "prompt" &&
    handwritingEnabled &&
    !autoReveal &&
    drawIdx === chars.length - 1 &&
    (snapshots[drawIdx] ?? null) !== null;

  const stateRef = useRef({ phase, selected, canRollback });
  stateRef.current = { phase, selected, canRollback };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") return navigate(PATHS.hoje);

      const { phase: p, canRollback: cr } = stateRef.current;
      if ((e.key === "Backspace" || e.key === "z") && cr) {
        e.preventDefault();
        return rollback();
      }
      if (p === "revealed") {
        const hit = gradeByHotkey(e.key);
        if (hit) {
          e.preventDefault();
          return setSelected(hit.key);
        }
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        void goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, rollback, navigate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const dismissal = (
    <div className="flex flex-1 items-center justify-center px-4">
      {items.length === 0 ? (
        <Empty message={emptyMessage} />
      ) : (
        <Summary
          mode={mode}
          record={record}
          done={done}
          correct={correct}
          skipped={skipped}
          accuracy={accuracy}
        />
      )}
    </div>
  );

  if (items.length === 0 || finished || !current) {
    if (desktop) {
      return (
        <DesktopStage>
          <div className="flex flex-1 items-center justify-center px-4">{dismissal}</div>
        </DesktopStage>
      );
    }
    return (
      <div className={`flex min-h-[100dvh] flex-col bg-gradient-to-b ${bandClass}`}>
        {dismissal}
      </div>
    );
  }

  const comparing = phase === "peek" || phase === "revealed";
  const questionStrip = (
    <p className="flex items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-white/10">
      <span aria-hidden>{comparing ? "🔍" : "✍️"}</span>
      {questionLabel(phase, handwritingEnabled)}
    </p>
  );

  const showSlotRow = handwritingEnabled && (phase === "prompt" || comparing);

  // The recall row gives the drawing slot a definite height (stretch in a row,
  // leftover in a column) so the canvas can measure it; below ~22rem the row
  // stacks so the square keeps a legible minimum instead of shrinking forever.
  const handwritingRowClass = desktop
    ? "flex items-center gap-3"
    : stackHandwriting
      ? "flex min-h-0 w-full flex-1 flex-col gap-3"
      : "flex min-h-0 w-full flex-1 items-stretch justify-center gap-3";
  const handwritingSlotClass = desktop
    ? "flex items-center justify-center"
    : "flex min-h-0 min-w-0 flex-1 items-center justify-center";
  const clearButtonClass = `inline-flex shrink-0 items-center justify-center rounded-full bg-slate-800 px-3 text-[11px] font-medium text-slate-200 ring-1 ring-white/10 hover:bg-slate-700 ${
    desktop
      ? "self-center py-1"
      : stackHandwriting
        ? "min-h-11 w-full py-2"
        : "min-h-11 self-center py-2"
  }`;

  const middle = (
    <>
      {!desktop && questionStrip}
      {showSlotRow && (
        <SlotRow
          chars={chars}
          snapshots={snapshots}
          currentIdx={drawIdx}
          reveal={phase === "revealed" ? "whole" : phase === "peek" ? "peek" : "none"}
          peekModel={peekStrokes?.strokes ?? []}
        />
      )}
      {phase === "info" && (
        <p className="px-4 text-center text-[11px] text-slate-400 lg:text-xs">
          Memorize os traços acima — a seguir você escreve de memória.
        </p>
      )}
      {phase === "prompt" &&
        (handwritingEnabled ? (
          <div
            className={
              desktop
                ? "flex flex-col items-center gap-2"
                : "flex min-h-[10rem] w-full flex-1 flex-col items-center gap-2"
            }
          >
            {chars.length > 1 && (
              <p className="text-xs text-slate-400 lg:hidden">
                caractere {drawIdx + 1}/{chars.length}
              </p>
            )}
            <div className={handwritingRowClass}>
              <div
                className={handwritingSlotClass}
                style={desktop ? { width: handwritingCap, height: handwritingCap } : undefined}
              >
                <HandwritingStep
                  key={`${current.id}-${drawIdx}-${redrawCount}`}
                  character={chars[drawIdx]}
                  onComplete={handleCharComplete}
                />
              </div>
              <button type="button" onClick={clearCurrent} className={clearButtonClass}>
                Limpar
              </button>
            </div>
            {awaitingReveal && (
              <p className="text-center text-xs text-slate-400">
                Pronto — toque em “Revelar” para comparar a palavra.
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400">
            Escrita à mão desligada — use “Revelar” para avaliar.
          </p>
        ))}
      {phase === "peek" && (
        <p className="text-center text-xs text-slate-500">
          Só este caractere. “Continuar” segue para o próximo.
        </p>
      )}
      {phase === "revealed" && (
        <div className="text-center">
          {selected ? (
            <>
              <p className="text-sm font-semibold text-slate-100">{gradeConsequence(selected)}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                “Próximo” confirma a nota e avança. “Rollback” limpa a nota.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Escolha uma nota — o cartão já está revelado, nada foi gravado ainda.
            </p>
          )}
          <Link
            to={itemPath(current.id)}
            className="mt-3 inline-block text-xs text-slate-500 hover:text-slate-300"
          >
            ver página do item
          </Link>
        </div>
      )}
    </>
  );

  const band = (
    <PracticeBand
      presentation={presentation}
      item={current}
      title={topBarTitle(mode, record)}
      band={bandClass}
      practice={practice}
      phase={phase}
      progress={{
        itemCount: items.length,
        grades,
        done,
        remaining,
        accuracy,
        showAccuracy: mode === "review",
      }}
      playerOn={playerOn}
      onTogglePlayer={() => setPlayerOn((on) => !on)}
      canRollback={canRollback}
      onRollback={rollback}
      onExit={() => navigate(PATHS.hoje)}
      handwritingEnabled={handwritingEnabled}
      onHandwritingEnabledChange={setHandwritingEnabled}
    />
  );

  const dock = (
    <PracticeDock
      presentation={presentation}
      revealed={phase === "revealed"}
      selected={selected}
      canRollback={canRollback}
      canNext={canGoNext}
      submitting={submitting}
      nextLabel={NEXT_LABEL[phase]}
      onSelect={setSelected}
      onRollback={rollback}
      onNext={() => void goNext()}
    />
  );

  if (desktop) {
    return (
      <>
        <DesktopStage>
          {band}
          <div className="relative z-10 -mt-5 flex justify-center">{questionStrip}</div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-2">
            <div className="my-auto flex w-full flex-col items-center gap-3">{middle}</div>
          </div>
          {dock}
        </DesktopStage>
        {toast && <Toast message={toast} />}
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-200">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {band}
        <div
          className="flex grow flex-col items-center justify-center gap-3 py-3"
          style={STAGE_HORIZONTAL_PADDING}
        >
          {middle}
        </div>
      </div>
      {dock}
      {toast && <Toast message={toast} />}
    </div>
  );
}

function DesktopStage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-3">
      <div className="flex h-[calc(100dvh-1.5rem)] max-h-[720px] w-full max-w-[720px] flex-col overflow-hidden rounded-[2rem] bg-slate-950 text-slate-200 ring-1 ring-white/10">
        {children}
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-lg text-white">{message}</p>
      <Link to="/" className="text-sm text-white/80 underline hover:text-white">
        Voltar ao painel
      </Link>
    </div>
  );
}

function Summary({
  mode,
  record,
  done,
  correct,
  skipped,
  accuracy,
}: {
  mode: QuizMode;
  record: boolean;
  done: number;
  correct: number;
  skipped: number;
  accuracy: number;
}) {
  const copy = summaryCopy(mode, record);
  return (
    <div className="flex flex-col items-center gap-6 text-center text-white">
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <div className="flex gap-8">
        <Metric label={copy.doneLabel} value={done} />
        {mode === "review" && <Metric label="Acertos" value={correct} />}
        {mode === "review" && <Metric label="Precisão" value={`${accuracy}%`} />}
        {skipped > 0 && <Metric label="Pulados" value={skipped} />}
      </div>
      {copy.note && <p className="text-sm text-white/80">{copy.note}</p>}
      <Link
        to="/"
        className="rounded-lg bg-white px-6 py-2.5 font-semibold text-slate-900 hover:bg-white/90"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}
