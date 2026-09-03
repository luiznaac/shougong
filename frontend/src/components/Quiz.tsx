import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client.ts";
import type { SrsRating, StudyItem } from "../api/types.ts";
import { Pinyin } from "./Pinyin.tsx";

export const RATINGS: {
  key: SrsRating;
  label: string;
  hotkey: string;
  className: string;
}[] = [
  { key: "again", label: "Errei", hotkey: "1", className: "bg-rose-600" },
  { key: "hard", label: "Difícil", hotkey: "2", className: "bg-amber-600" },
  { key: "good", label: "Bom", hotkey: "3", className: "bg-emerald-600" },
  { key: "easy", label: "Fácil", hotkey: "4", className: "bg-sky-600" },
];

type Phase = "info" | "prompt" | "revealed";

const QUESTION_LABEL: Record<Phase, string> = {
  info: "Estude o item",
  prompt: "Escreva o caractere à mão",
  revealed: "Você acertou a escrita?",
};

const NEXT_LABEL: Record<Phase, string> = {
  info: "Continuar",
  prompt: "Revelar",
  revealed: "Próximo",
};

/**
 * Full-screen quiz runner shared by Review and Lesson, HanziHero-styled:
 * a coloured subject band (pinyin + flip cards + meaning), a question band,
 * then a bottom toolbar. Nothing is submitted until "Próximo" confirms; the
 * selected grade can be undone with "Rollback".
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
  const [selected, setSelected] = useState<SrsRating | null>(null);
  const [done, setDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const current = items[idx];
  const remaining = items.length - idx;
  const accuracy = done > 0 ? Math.round((correct / done) * 100) : 100;
  const finished = idx >= items.length;

  const bandClass =
    mode === "lesson"
      ? "from-violet-600 to-violet-800"
      : "from-rose-500 to-accent-600";

  const advance = useCallback(() => {
    setSelected(null);
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
      await api.reviewStudyItem(current.id, selected);
      setDone((n) => n + 1);
      if (selected !== "again") setCorrect((n) => n + 1);
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
  }, [phase, selected, submitting, current, advance]);

  // Backward: undo the selected grade, else step back a phase.
  const rollback = useCallback(() => {
    if (submitting) return;
    if (phase === "revealed") {
      if (selected) return setSelected(null);
      return setPhase("prompt");
    }
    if (phase === "prompt" && mode === "lesson") return setPhase("info");
  }, [phase, selected, submitting, mode]);

  const canRollback =
    phase === "revealed" || (phase === "prompt" && mode === "lesson");
  const canGoNext = phase !== "revealed" || selected != null;

  const stateRef = useRef({ phase, selected, canRollback });
  stateRef.current = { phase, selected, canRollback };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") return navigate("/");

      const { phase: p, canRollback: cr } = stateRef.current;
      if ((e.key === "Backspace" || e.key === "z") && cr) {
        e.preventDefault();
        return rollback();
      }
      if (p === "revealed") {
        const hit = RATINGS.find((r) => r.hotkey === e.key);
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

  const topBar = (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 py-2.5 text-sm text-white/90">
      <button onClick={() => navigate("/")} className="hover:text-white" title="Sair (Esc)">
        ← Sair
      </button>
      <span className="text-xs uppercase tracking-widest text-white/60">
        {mode === "lesson" ? "Lição" : "Review"}
      </span>
      <div className="ml-auto flex items-center gap-4 tabular-nums">
        <span title="Concluídos">✓ {done}</span>
        <span title="Restantes">☰ {Math.max(0, remaining)}</span>
        {mode === "review" && <span title="Acertos">👍 {accuracy}%</span>}
      </div>
    </div>
  );

  if (items.length === 0 || finished || !current) {
    return (
      <div className={`relative flex min-h-screen flex-col bg-gradient-to-b ${bandClass}`}>
        {topBar}
        <div className="flex flex-1 items-center justify-center px-4">
          {items.length === 0 ? (
            <Empty message={emptyMessage} />
          ) : (
            <Summary
              mode={mode}
              done={done}
              correct={correct}
              skipped={skipped}
              accuracy={accuracy}
            />
          )}
        </div>
      </div>
    );
  }

  const chars = [...current.entry.simplified];
  const sizePx = Math.min(180, Math.round((520 - (chars.length - 1) * 12) / chars.length));

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {/* subject band */}
      <section
        className={`relative flex flex-col items-center justify-center gap-5 bg-gradient-to-b ${bandClass} px-4 pb-8 pt-14`}
      >
        {topBar}

        <div className="rounded-full bg-slate-950/40 px-5 py-1.5 backdrop-blur-sm">
          <Pinyin
            value={current.entry.pinyin}
            className="text-2xl font-medium sm:text-3xl"
          />
        </div>

        <div key={current.id} className="flex flex-wrap items-center justify-center gap-3">
          {chars.map((ch, i) => (
            <FlipCard key={i} char={ch} hidden={phase === "prompt"} sizePx={sizePx} />
          ))}
        </div>

        <p className="max-w-lg text-lg font-semibold text-white drop-shadow sm:text-xl">
          {current.entry.definitions.slice(0, 3).join(" · ")}
        </p>
      </section>

      {/* question band */}
      <section className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-4 text-center text-lg font-medium text-slate-100 sm:text-2xl">
        <span aria-hidden>{phase === "revealed" ? "✅" : "✍️"}</span>
        <span>{QUESTION_LABEL[phase]}</span>
      </section>

      {/* grade selection */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
        {phase === "info" && (
          <p className="text-center text-sm text-slate-400">
            Memorize o traçado — a seguir você escreve de memória.
          </p>
        )}
        {phase === "revealed" && (
          <div className="grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            {RATINGS.map((r) => {
              const isOn = selected === r.key;
              const dim = selected != null && !isOn;
              return (
                <button
                  key={r.key}
                  onClick={() => setSelected(r.key)}
                  className={`rounded-lg px-4 py-3 font-semibold transition ${
                    dim
                      ? "bg-slate-800 text-slate-500"
                      : `${r.className} text-white`
                  } ${isOn ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""}`}
                >
                  {r.label}
                  <kbd className="ml-2 rounded bg-black/25 px-1.5 text-xs">{r.hotkey}</kbd>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-3 border-t border-white/10 bg-slate-900/70 px-4 py-3">
        <button
          onClick={rollback}
          disabled={!canRollback || submitting}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-30"
          title="Desfazer (Backspace)"
        >
          ↩ Rollback
        </button>

        {phase === "revealed" && (
          <Link
            to={`/items/${current.id}`}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            ver página do item
          </Link>
        )}

        <button
          onClick={() => void goNext()}
          disabled={!canGoNext || submitting}
          className="ml-auto rounded-md bg-accent-500 px-6 py-2 font-semibold text-white transition hover:bg-accent-600 disabled:opacity-40"
          title="Confirmar (Enter)"
        >
          {NEXT_LABEL[phase]} →
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * One flip card holding a single character. The whole set flips together (same
 * `hidden`); each shows its character on the front and a dashed "?" on the back.
 */
function FlipCard({
  char,
  hidden,
  sizePx,
}: {
  char: string;
  hidden: boolean;
  sizePx: number;
}) {
  return (
    <div style={{ perspective: "1200px" }}>
      <div
        style={{ width: sizePx, height: sizePx }}
        className={`relative transition-transform duration-500 [transform-style:preserve-3d] [will-change:transform] motion-reduce:transition-none ${
          hidden ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-white/25 bg-white/10 backdrop-blur-sm [backface-visibility:hidden]">
          <span
            lang="zh-Hans"
            className="font-hanzi leading-none text-white"
            style={{ fontSize: sizePx * 0.62 }}
          >
            {char}
          </span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-white/40 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span
            aria-hidden
            className="font-hanzi leading-none text-white/50 select-none"
            style={{ fontSize: sizePx * 0.55 }}
          >
            ?
          </span>
        </div>
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
    <div className="flex flex-col items-center gap-6 text-center text-white">
      <h1 className="text-2xl font-bold">
        {mode === "lesson" ? "Lição concluída 🎉" : "Sessão concluída 🎉"}
      </h1>
      <div className="flex gap-8">
        <Metric label={mode === "lesson" ? "Aprendidos" : "Revisados"} value={done} />
        {mode === "review" && <Metric label="Acertos" value={correct} />}
        {mode === "review" && <Metric label="Precisão" value={`${accuracy}%`} />}
        {skipped > 0 && <Metric label="Pulados" value={skipped} />}
      </div>
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
