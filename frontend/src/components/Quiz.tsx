import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.ts";
import type { SrsRating, StudyItem } from "../api/types.ts";
import { Pinyin } from "./Pinyin.tsx";
import { Hanzi } from "./Hanzi.tsx";

export const RATINGS: {
  key: SrsRating;
  label: string;
  hotkey: string;
  className: string;
}[] = [
  { key: "again", label: "Errei", hotkey: "1", className: "bg-rose-600 hover:bg-rose-500" },
  { key: "hard", label: "Difícil", hotkey: "2", className: "bg-amber-600 hover:bg-amber-500" },
  { key: "good", label: "Bom", hotkey: "3", className: "bg-emerald-600 hover:bg-emerald-500" },
  { key: "easy", label: "Fácil", hotkey: "4", className: "bg-sky-600 hover:bg-sky-500" },
];

type Phase = "info" | "prompt" | "revealed";

/**
 * Full-screen quiz runner shared by Review and Lesson.
 * - review mode: prompt (pinyin + meanings, hanzi hidden) → reveal → self-grade
 * - lesson mode: an extra "info" step first, showing the full item to learn
 */
export function Quiz({
  items,
  mode,
  emptyMessage,
}: {
  items: StudyItem[];
  mode: "review" | "lesson";
  emptyMessage: string;
}) {
  const navigate = useNavigate();

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>(mode === "lesson" ? "info" : "prompt");
  const [done, setDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const current = items[idx];
  const remaining = items.length - idx;
  const accuracy = done > 0 ? Math.round((correct / done) * 100) : 100;
  const finished = idx >= items.length;

  const advance = useCallback(() => {
    setPhase(mode === "lesson" ? "info" : "prompt");
    setIdx((i) => i + 1);
  }, [mode]);

  const grade = useCallback(
    async (rating: SrsRating) => {
      if (!current || submitting) return;
      setSubmitting(true);
      try {
        await api.reviewStudyItem(current.id, rating);
        setDone((n) => n + 1);
        if (rating !== "again") setCorrect((n) => n + 1);
        advance();
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setToast("Item não estava disponível — pulado.");
          setSkipped((n) => n + 1);
          advance();
        } else {
          setToast(`Erro ao enviar: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting, advance],
  );

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") {
        navigate("/");
        return;
      }
      if (phaseRef.current === "info") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setPhase("prompt");
        }
      } else if (phaseRef.current === "prompt") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setPhase("revealed");
        }
      } else {
        const hit = RATINGS.find((r) => r.hotkey === e.key);
        if (hit) {
          e.preventDefault();
          void grade(hit.key);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade, navigate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <div className="flex items-center gap-4 border-b border-white/10 bg-slate-900/60 px-4 py-2 text-sm">
        <button
          onClick={() => navigate("/")}
          className="text-slate-400 hover:text-slate-200"
          title="Sair (Esc)"
        >
          ← Sair
        </button>
        <span className="text-slate-500">{mode === "lesson" ? "Lição" : "Review"}</span>
        <div className="ml-auto flex items-center gap-4 tabular-nums text-slate-300">
          <span title="Concluídos">✓ {done}</span>
          <span title="Restantes">☰ {Math.max(0, remaining)}</span>
          {mode === "review" && <span title="Acertos">👍 {accuracy}%</span>}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        {items.length === 0 ? (
          <Empty message={emptyMessage} />
        ) : finished ? (
          <Summary
            mode={mode}
            done={done}
            correct={correct}
            skipped={skipped}
            accuracy={accuracy}
          />
        ) : (
          current && (
            <div key={current.id} className="w-full max-w-xl">
              <QuizCard
                item={current}
                phase={phase}
                onContinue={() => setPhase("prompt")}
                onReveal={() => setPhase("revealed")}
                onGrade={grade}
                disabled={submitting}
              />
            </div>
          )
        )}
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

const PHASE_LABEL: Record<Phase, string> = {
  info: "Item novo",
  prompt: "Escreva à mão",
  revealed: "Você acertou a escrita?",
};

/**
 * One card layout across all phases — the label, pinyin and meanings hold their
 * place; only the centre panel flips. It shows the hanzi at `info` and
 * `revealed`, and flips over to a dashed "?" for `prompt`, so both the
 * lesson→quiz hide and the quiz reveal read as the same card turning.
 */
function QuizCard({
  item,
  phase,
  onContinue,
  onReveal,
  onGrade,
  disabled,
}: {
  item: StudyItem;
  phase: Phase;
  onContinue: () => void;
  onReveal: () => void;
  onGrade: (r: SrsRating) => void;
  disabled: boolean;
}) {
  const hidden = phase === "prompt";

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="h-4 text-xs font-medium uppercase tracking-widest text-slate-500">
        {PHASE_LABEL[phase]}
      </p>

      <Pinyin value={item.entry.pinyin} className="text-4xl font-light sm:text-5xl" />

      <ul className="space-y-1 text-lg text-slate-300">
        {item.entry.definitions.slice(0, 5).map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>

      <div className="[perspective:1200px]">
        <div
          className={`relative h-56 w-56 transition-transform duration-500 [transform-style:preserve-3d] [will-change:transform] motion-reduce:transition-none ${
            hidden ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
          }`}
        >
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-accent-500/40 bg-slate-900 [backface-visibility:hidden]">
            <Hanzi
              text={item.entry.simplified}
              singleCharPx={112}
              boxPx={224}
              className="text-slate-50"
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-white/15 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="font-hanzi text-8xl text-slate-700 select-none" aria-hidden>
              ?
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-[6rem] flex-col items-center justify-start gap-3">
        {phase === "info" ? (
          <>
            <p className="text-sm text-slate-500">
              Memorize o traçado — a seguir você escreve de memória.
            </p>
            <ActionButton onClick={onContinue}>Continuar</ActionButton>
          </>
        ) : phase === "prompt" ? (
          <ActionButton onClick={onReveal}>Revelar</ActionButton>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATINGS.map((r) => (
              <button
                key={r.key}
                disabled={disabled}
                onClick={() => onGrade(r.key)}
                className={`rounded-lg px-5 py-3 font-semibold text-white transition-colors disabled:opacity-50 ${r.className}`}
              >
                {r.label}
                <kbd className="ml-2 rounded bg-black/20 px-1.5 text-xs">{r.hotkey}</kbd>
              </button>
            ))}
          </div>
        )}
      </div>

      <Link
        to={`/items/${item.id}`}
        className={`text-xs text-slate-500 hover:text-slate-300 ${
          phase === "revealed" ? "" : "invisible"
        }`}
      >
        ver página do item
      </Link>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-slate-100 px-8 py-3 font-semibold text-slate-900 hover:bg-white"
    >
      {children} <kbd className="ml-2 rounded bg-slate-300 px-1.5 text-xs">espaço</kbd>
    </button>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-lg text-slate-300">{message}</p>
      <Link to="/" className="text-sm text-accent-500 hover:underline">
        Voltar ao painel
      </Link>
    </div>
  );
}

function Summary({
  mode,
  done,
  correct,
  skipped,
  accuracy,
}: {
  mode: "review" | "lesson";
  done: number;
  correct: number;
  skipped: number;
  accuracy: number;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-bold text-slate-100">
        {mode === "lesson" ? "Lição concluída 🎉" : "Sessão concluída 🎉"}
      </h1>
      <div className="flex gap-8 text-slate-300">
        <Metric label={mode === "lesson" ? "Aprendidos" : "Revisados"} value={done} />
        {mode === "review" && <Metric label="Acertos" value={correct} />}
        {mode === "review" && <Metric label="Precisão" value={`${accuracy}%`} />}
        {skipped > 0 && <Metric label="Pulados" value={skipped} />}
      </div>
      <Link
        to="/"
        className="rounded-lg bg-accent-500 px-6 py-2.5 font-semibold text-white hover:bg-accent-600"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-3xl font-bold tabular-nums text-slate-100">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
