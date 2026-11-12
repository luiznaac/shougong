import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client.ts";
import { useReviewMutation } from "../api/queries.ts";
import type { SrsRating, StudyItem } from "../api/types.ts";
import { useHandwritingEnabled, useHandwritingTolerance } from "../lib/localSettings.ts";
import { PATHS, itemPath } from "../lib/navigation.ts";
import { gradeByHotkey, gradeConsequence } from "../lib/practiceGrades.ts";
import {
  NEXT_LABEL,
  QUESTION_LABEL,
  type QuizMode,
  type QuizPhase,
  stageBandClass,
  submitRevealedGrade,
  summaryCopy,
  topBarTitle,
} from "../lib/quizPractice.ts";
import { STAGE_HORIZONTAL_PADDING } from "../lib/safeArea.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";
import { HandwritingQuiz } from "./HandwritingQuiz.tsx";
import { PracticeBand } from "./PracticeBand.tsx";
import { PracticeDock } from "./PracticeDock.tsx";
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
 */
export function Quiz({
  items,
  mode,
  emptyMessage,
  record = true,
}: {
  items: StudyItem[];
  mode: QuizMode;
  emptyMessage: string;
  record?: boolean;
}) {
  const navigate = useNavigate();
  const { mutateAsync: review } = useReviewMutation();
  const desktop = useMediaQuery("(min-width: 1024px)");
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
  const [tolerancePercent, setTolerancePercent] = useHandwritingTolerance();
  const [drawIdx, setDrawIdx] = useState(0);
  const drawFailedRef = useRef(false);

  const current = items[idx];
  const chars = current ? [...current.entry.simplified] : [];
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
  }, [mode]);

  // Forward: info → prompt → revealed → (submit + next). On `revealed` it only
  // fires once a grade is selected, so it doubles as the answer confirmation.
  const goNext = useCallback(async () => {
    if (submitting || !current) return;
    if (phase === "info") return setPhase("prompt");
    if (phase === "prompt") return setPhase("revealed");
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
  }, [phase, selected, submitting, current, advance, review, record]);

  // Backward: undo the selected grade, else step back a phase.
  const rollback = useCallback(() => {
    if (submitting) return;
    if (phase === "revealed") {
      if (selected) return setSelected(null);
      return setPhase("prompt");
    }
    if (phase === "prompt" && mode === "lesson") return setPhase("info");
  }, [phase, selected, submitting, mode]);

  // Handwriting quiz: one character at a time. A failing character pre-selects
  // "Errei" — same as if the user had clicked it themselves, so the existing
  // rating grid / rollback / submit flow handles the rest with no new logic.
  const handleCharResult = useCallback(
    (passed: boolean) => {
      if (!passed) drawFailedRef.current = true;
      const next = drawIdx + 1;
      if (next >= chars.length) {
        setPhase("revealed");
        setSelected(drawFailedRef.current ? "again" : null);
      } else {
        setDrawIdx(next);
      }
    },
    [drawIdx, chars.length],
  );

  const canRollback = phase === "revealed" || (phase === "prompt" && mode === "lesson");
  const canGoNext = phase !== "revealed" || selected != null;

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

  // Reset the drawing sequence every time a "write from memory" step begins
  // (a new item, or rolling back into "prompt") so it always starts fresh.
  const promptedItemId = phase === "prompt" ? current?.id : undefined;
  useEffect(() => {
    if (promptedItemId === undefined) return;
    setDrawIdx(0);
    drawFailedRef.current = false;
  }, [promptedItemId]);

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

  const questionStrip = (
    <p className="flex items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-100 ring-1 ring-white/10">
      <span aria-hidden>{phase === "revealed" ? "✅" : "✍️"}</span>
      {QUESTION_LABEL[phase]}
    </p>
  );

  const middle = (
    <>
      {!desktop && questionStrip}
      {phase === "info" && (
        <p className="px-4 text-center text-[11px] text-slate-400 lg:text-xs">
          Memorize os traços acima — a seguir você escreve de memória.
        </p>
      )}
      {phase === "prompt" &&
        (handwritingEnabled ? (
          <div className="flex flex-col items-center gap-2">
            {chars.length > 1 && (
              <p className="text-xs text-slate-400">
                caractere {drawIdx + 1}/{chars.length}
              </p>
            )}
            <HandwritingQuiz
              key={`${current.id}-${drawIdx}`}
              character={chars[drawIdx]}
              tolerancePercent={tolerancePercent}
              sizePx={desktop ? 170 : 150}
              onResult={handleCharResult}
            />
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400">
            Escrita à mão desligada — use “Revelar” para avaliar.
          </p>
        ))}
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
      tolerancePercent={tolerancePercent}
      onToleranceChange={setTolerancePercent}
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
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-8 py-4">
            {middle}
          </div>
          {dock}
        </DesktopStage>
        {toast && <Toast message={toast} />}
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-200">
      {band}
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto py-3"
        style={STAGE_HORIZONTAL_PADDING}
      >
        {middle}
      </div>
      {dock}
      {toast && <Toast message={toast} />}
    </div>
  );
}

function DesktopStage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 p-6">
      <div className="flex h-[calc(100dvh-3rem)] max-h-[720px] w-full max-w-[720px] flex-col overflow-hidden rounded-[2rem] bg-slate-950 text-slate-200 ring-1 ring-white/10">
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
