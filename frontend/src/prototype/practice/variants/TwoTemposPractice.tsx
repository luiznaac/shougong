// Variant G — "Dois tempos" (wayfinder #111, new template). The surface changes
// shape with the phase instead of holding one arrangement: answering is a
// writing sheet (pinyin, hidden cards, one big paper), evaluating is a two-up
// spread (what you wrote next to the notes and the grade rows). Your ink stays
// on screen after the reveal, shrunk to a "seu traço" thumbnail, because the pad
// is never unmounted.

import { Link } from "react-router-dom";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import {
  FlipCards,
  KeyboardLegend,
  ProgressSegments,
  SrsIntactChip,
  StrokeMock,
  SummaryPanel,
  Toast,
  WritePad,
} from "../parts.tsx";
import { GRADES, MODES, type PracticeMode } from "../practiceData.ts";
import {
  PHASE_NEXT,
  PHASE_QUESTION,
  type PracticeSession,
  usePracticeSession,
} from "../session.ts";

const HINT: Record<string, string> = {
  info: "Memorize o traçado — a seguir você escreve de memória.",
  prompt: "Escreva de memória. O cartão revela quando você conferir.",
  revealed: "",
};

function GradeRows({ session }: { session: PracticeSession }) {
  const revealed = session.phase === "revealed";
  return (
    <div className="flex flex-col gap-2">
      {GRADES.map((grade) => {
        const on = session.selected === grade.key;
        const dim = session.selected != null && !on;
        const tone = !revealed
          ? "bg-white/5 text-slate-500"
          : dim
            ? "bg-slate-900 text-slate-500"
            : `${grade.bg} text-white`;
        return (
          <button
            key={grade.key}
            type="button"
            disabled={!revealed}
            onClick={() => session.select(grade.key)}
            className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-left transition ${tone} ${
              on ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""
            }`}
          >
            <span>
              <span className="block text-sm font-semibold">{grade.label}</span>
              <span className="block text-[10px] opacity-70">{grade.hint}</span>
            </span>
            <kbd className="rounded bg-black/25 px-2 py-0.5 text-xs font-normal">
              {grade.hotkey}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}

function TwoTemposDesktop({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const sheet = session.phase !== "revealed";

  if (session.finished || !item) {
    return (
      <div className="flex h-[720px] flex-col justify-center overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
        <SummaryPanel session={session} />
      </div>
    );
  }

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-7 py-3 text-sm">
        <Link to="/" className="text-slate-400 hover:text-slate-200">
          ← Sair
        </Link>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase ring-1 ${meta.chip}`}
        >
          {meta.eyebrow}
        </span>
        {session.mode === "practice" && <SrsIntactChip />}
        <label className="ml-2 flex items-center gap-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={session.handwriting}
            onChange={(e) => session.setHandwriting(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          Escrever à mão
        </label>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          ✓ {session.done} · ☰ {session.remaining}
          {session.mode === "review" && ` · 👍 ${session.accuracy}%`}
        </span>
      </header>
      <ProgressSegments items={session.items} grades={session.grades} className="mx-7 mt-3" />

      {sheet ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 py-4">
          <Pinyin value={item.pinyin} className="text-3xl font-medium" />
          <FlipCards chars={chars} hidden={session.phase === "prompt"} available={430} />
          <p className="text-center text-base font-semibold text-slate-200">
            {item.definitions.slice(0, 3).join(" · ")}
          </p>
          {session.phase === "info" ? (
            <StrokeMock word={item.simplified} className="mt-1" />
          ) : (
            <div className="mt-1 w-[300px]">
              <WritePad character={item.simplified[0]} className="aspect-square" />
            </div>
          )}
          <div className="mt-1 flex w-full max-w-xl items-center gap-4">
            <p className="text-xs text-slate-500">{HINT[session.phase]}</p>
            <button
              type="button"
              onClick={session.next}
              className="ml-auto rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600"
            >
              {PHASE_NEXT[session.phase]} →
            </button>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-[1.1fr_0.9fr] overflow-hidden">
          <section className="flex flex-col items-center justify-center gap-3 border-r border-white/10 px-8">
            <Pinyin value={item.pinyin} className="text-2xl font-medium" />
            <FlipCards chars={chars} hidden={false} available={380} />
            <p className="text-center text-base font-semibold text-slate-200">
              {item.definitions.slice(0, 3).join(" · ")}
            </p>
            <div className="mt-2 flex items-end gap-4">
              {session.handwriting && (
                <figure className="flex flex-col items-center gap-1">
                  <div className="w-[110px]">
                    <WritePad character={item.simplified[0]} className="aspect-square" />
                  </div>
                  <figcaption className="text-[10px] tracking-wide text-slate-500 uppercase">
                    Seu traço
                  </figcaption>
                </figure>
              )}
              <StrokeMock word={item.simplified} />
            </div>
          </section>

          <aside className="flex flex-col gap-4 bg-slate-900/40 p-6">
            <div className="rounded-xl bg-slate-950/60 px-4 py-3 ring-1 ring-white/10">
              <p className="text-[10px] tracking-widest text-slate-500 uppercase">Pergunta</p>
              <p className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-100">
                <span aria-hidden>✅</span>
                {PHASE_QUESTION.revealed}
              </p>
            </div>
            <div className="flex flex-1 flex-col justify-center">
              <GradeRows session={session} />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={session.rollback}
                disabled={!session.canRollback}
                className="rounded-lg py-2 text-xs font-medium text-slate-400 transition hover:bg-white/5 disabled:opacity-30"
              >
                ↩ Rollback (⌫)
              </button>
              <button
                type="button"
                onClick={session.next}
                disabled={!session.canNext}
                className="rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-40"
              >
                {PHASE_NEXT[session.phase]} →
              </button>
              <KeyboardLegend className="pt-1" />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function TwoTemposMobile({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const sheet = session.phase !== "revealed";

  if (session.finished || !item) {
    return (
      <div className="flex h-full flex-col justify-center bg-slate-950">
        <SummaryPanel session={session} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <header className="flex shrink-0 items-center gap-2 px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-2 text-xs">
        <Link to="/" className="text-slate-400">
          ← Sair
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-widest uppercase ring-1 ${meta.chip}`}
        >
          {meta.eyebrow}
        </span>
        {session.mode === "practice" && <SrsIntactChip />}
        <span className="ml-auto text-slate-400 tabular-nums">
          ✓ {session.done} · ☰ {session.remaining}
        </span>
      </header>
      <ProgressSegments items={session.items} grades={session.grades} className="mx-4" />

      {sheet ? (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 pt-2">
            <Pinyin value={item.pinyin} className="text-xl font-medium" />
            <FlipCards chars={chars} hidden={session.phase === "prompt"} available={300} />
            <p className="text-center text-sm font-semibold text-slate-200">
              {item.definitions.slice(0, 2).join(" · ")}
            </p>
            {session.phase === "info" ? (
              <StrokeMock word={item.simplified} />
            ) : (
              <div className="w-[220px]">
                <WritePad character={item.simplified[0]} className="aspect-square" />
              </div>
            )}
          </div>
          <div className="px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={session.next}
              className="h-11 w-full rounded-lg bg-accent-500 text-sm font-semibold text-white"
            >
              {PHASE_NEXT[session.phase]} →
            </button>
            <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-white/25" />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 overflow-y-auto px-4 pt-2">
            <Pinyin value={item.pinyin} className="text-xl font-medium" />
            <FlipCards chars={chars} hidden={false} available={300} />
            <p className="text-center text-sm font-semibold text-slate-200">
              {item.definitions.slice(0, 2).join(" · ")}
            </p>
            <div className="flex items-end gap-3">
              {session.handwriting && (
                <figure className="flex flex-col items-center gap-1">
                  <div className="w-[76px]">
                    <WritePad character={item.simplified[0]} className="aspect-square" />
                  </div>
                  <figcaption className="text-[9px] tracking-wide text-slate-500 uppercase">
                    Seu traço
                  </figcaption>
                </figure>
              )}
              <StrokeMock word={item.simplified} />
            </div>
            <p className="text-[11px] text-slate-400">✅ {PHASE_QUESTION.revealed}</p>
          </div>

          <div className="border-t border-white/10 bg-slate-900/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-4 gap-1.5">
              {GRADES.map((grade) => {
                const on = session.selected === grade.key;
                const dim = session.selected != null && !on;
                const tone = dim ? "bg-slate-800 text-slate-500" : `${grade.bg} text-white`;
                return (
                  <button
                    key={grade.key}
                    type="button"
                    onClick={() => session.select(grade.key)}
                    className={`h-12 rounded-lg text-[11px] font-semibold ${tone} ${
                      on ? "ring-2 ring-white" : ""
                    }`}
                  >
                    {grade.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={session.rollback}
                disabled={!session.canRollback}
                aria-label="Rollback"
                className="grid h-11 w-12 place-items-center rounded-lg bg-white/5 text-slate-300 disabled:opacity-30"
              >
                ↩
              </button>
              <button
                type="button"
                onClick={session.next}
                disabled={!session.canNext}
                className="h-11 flex-1 rounded-lg bg-accent-500 text-sm font-semibold text-white disabled:opacity-40"
              >
                {PHASE_NEXT[session.phase]} →
              </button>
            </div>
            <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-white/25" />
          </div>
        </>
      )}
    </div>
  );
}

export function TwoTemposPractice({ mode }: { mode: PracticeMode }) {
  const session = usePracticeSession(mode);
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Variante G — Dois tempos · desktop
          </p>
          <div className="mt-3">
            <TwoTemposDesktop session={session} />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mt-10 flex items-center gap-3">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Mobile · 390px
            </span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="mt-4 flex justify-center">
            <PhoneFrame caption="A tela muda de forma com a fase: folha de escrita → avaliação com o seu traço ao lado.">
              <TwoTemposMobile session={session} />
            </PhoneFrame>
          </div>
        </div>
      </div>
      <Toast message={session.toast} />
    </>
  );
}
