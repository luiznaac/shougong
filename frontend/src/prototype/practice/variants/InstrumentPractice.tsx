// Variant F — "Instrumento" (wayfinder #111, new template). Treats the runner as
// an instrument: no coloured block, no card — the word is the screen, and the
// controls are a keyboard-shaped bar docked at the bottom, each note a key with
// its own numeral, SRS consequence and a rollback/advance key at the ends. The
// mode's colour survives only as the edge light and the tinted chips.

import { Link } from "react-router-dom";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import {
  ActionArea,
  FlipCards,
  ProgressSegments,
  SrsIntactChip,
  SummaryPanel,
  Toast,
} from "../parts.tsx";
import { GRADES, MODES, type PracticeMode } from "../practiceData.ts";
import {
  PHASE_NEXT,
  PHASE_QUESTION,
  type PracticeSession,
  usePracticeSession,
} from "../session.ts";

function InstrumentDesktop({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className="relative flex h-[720px] flex-col overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
        <div className={`h-0.5 w-full bg-gradient-to-r ${meta.band}`} />
        <div className="flex flex-1 items-center justify-center">
          <SummaryPanel session={session} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
      <div className={`h-0.5 w-full shrink-0 bg-gradient-to-r ${meta.band}`} />
      <header className="flex shrink-0 items-center gap-4 px-8 pt-4 text-sm">
        <Link to="/" className="text-slate-400 hover:text-slate-200">
          ← Sair
        </Link>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase ring-1 ${meta.chip}`}
        >
          {meta.eyebrow}
        </span>
        {session.mode === "practice" && <SrsIntactChip />}
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={session.handwriting}
            onChange={(e) => session.setHandwriting(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          Escrever à mão
        </label>
        <ProgressSegments items={session.items} grades={session.grades} className="mx-6 flex-1" />
        <span className="text-xs text-slate-400 tabular-nums">
          ✓ {session.done} · ☰ {session.remaining}
          {session.mode === "review" && ` · 👍 ${session.accuracy}%`}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
        <Pinyin value={item.pinyin} className="text-2xl font-medium opacity-80" />
        <FlipCards
          chars={chars}
          hidden={session.phase === "prompt"}
          available={700}
          cap={168}
          gap={14}
        />
        <p className="max-w-xl text-center text-xl font-semibold text-slate-200">
          {item.definitions.slice(0, 3).join(" · ")}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs tracking-wide text-slate-500 uppercase">
          <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </p>
        <ActionArea session={session} className="max-w-[150px]" />
      </div>

      <div className="shrink-0 border-t border-white/10 bg-slate-900/50 p-3">
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={session.rollback}
            disabled={!session.canRollback}
            className="flex w-20 flex-col items-center justify-center rounded-xl bg-white/5 text-slate-400 transition hover:bg-white/10 disabled:opacity-30"
          >
            <span className="text-lg leading-none">↩</span>
            <span className="mt-1 text-[10px]">⌫</span>
          </button>

          {GRADES.map((grade) => {
            const on = session.selected === grade.key;
            const dim = session.selected != null && !on;
            const tone = !revealed
              ? "bg-white/5 text-slate-500"
              : dim
                ? "bg-slate-900 text-slate-500 ring-1 ring-white/5"
                : `${grade.bg} text-white`;
            return (
              <button
                key={grade.key}
                type="button"
                disabled={!revealed}
                onClick={() => session.select(grade.key)}
                className={`relative flex h-24 flex-1 flex-col items-center justify-center rounded-xl transition ${tone} ${
                  on ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""
                }`}
              >
                <span className="absolute top-1.5 left-2.5 text-[11px] font-semibold opacity-60">
                  {grade.hotkey}
                </span>
                <span className="text-base font-semibold">{grade.label}</span>
                <span className="text-[10px] opacity-70">{grade.hint}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={session.next}
            disabled={!session.canNext}
            className="relative flex h-24 flex-[1.4] flex-col items-center justify-center rounded-xl bg-accent-500 text-white transition hover:bg-accent-600 disabled:opacity-40"
          >
            <span className="absolute top-1.5 right-2.5 text-[11px] font-semibold opacity-70">
              ⏎
            </span>
            <span className="text-base font-semibold">{PHASE_NEXT[session.phase]}</span>
            <span className="text-[10px] opacity-70">ou espaço</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InstrumentMobile({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className="flex h-full flex-col bg-slate-950">
        <div className={`h-0.5 w-full shrink-0 bg-gradient-to-r ${meta.band}`} />
        <div className="flex flex-1 flex-col justify-center">
          <SummaryPanel session={session} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div className={`h-0.5 w-full shrink-0 bg-gradient-to-r ${meta.band}`} />
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
        <button
          type="button"
          onClick={session.rollback}
          disabled={!session.canRollback}
          aria-label="Rollback"
          className="rounded-md px-1 text-sm text-slate-300 disabled:opacity-30"
        >
          ↩
        </button>
      </header>
      <ProgressSegments items={session.items} grades={session.grades} className="mx-4" />

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
        <Pinyin value={item.pinyin} className="text-xl font-medium opacity-80" />
        <FlipCards chars={chars} hidden={session.phase === "prompt"} available={300} />
        <p className="text-center text-sm font-semibold text-slate-200">
          {item.definitions.slice(0, 2).join(" · ")}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </p>
        <ActionArea session={session} className="w-32" />
      </div>

      <div className="shrink-0 border-t border-white/10 bg-slate-900/70 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-stretch gap-1.5">
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
                className={`flex h-14 flex-1 flex-col items-center justify-center rounded-lg ${tone} ${
                  on ? "ring-2 ring-white" : ""
                }`}
              >
                <span className="text-[9px] opacity-70">{grade.hotkey}</span>
                <span className="text-[10px] font-semibold">{grade.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={session.next}
          disabled={!session.canNext}
          className="mt-1.5 h-11 w-full rounded-lg bg-accent-500 text-sm font-semibold text-white disabled:opacity-40"
        >
          {PHASE_NEXT[session.phase]} →
        </button>
        <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-white/25" />
      </div>
    </div>
  );
}

export function InstrumentPractice({ mode }: { mode: PracticeMode }) {
  const session = usePracticeSession(mode);
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Variante F — Instrumento · desktop
          </p>
          <div className="mt-3">
            <InstrumentDesktop session={session} />
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
            <PhoneFrame caption="Sem bloco colorido: fio de cor de 2px, palavra grande e teclado de notas no polegar.">
              <InstrumentMobile session={session} />
            </PhoneFrame>
          </div>
        </div>
      </div>
      <Toast message={session.toast} />
    </>
  );
}
