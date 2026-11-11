// Variant A — "Palco" (wayfinder #111). The full-screen runner keeps the
// production vertical order (band → question → action → toolbar), but on desktop
// it is bounded into one stage that fits the viewport, and the four grades are
// permanently docked at the bottom so the keys are learnable before the reveal.
// Mobile keeps full-bleed bands and turns the dock into a two-by-two thumb grid.

import { Link } from "react-router-dom";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { keyedOccurrences } from "../../../lib/occurrenceKeys.ts";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import {
  ActionArea,
  FlipTile,
  KeyboardLegend,
  ProgressSegments,
  SessionCounters,
  SrsIntactChip,
  SummaryPanel,
  Toast,
  tileSize,
} from "../parts.tsx";
import { GRADES, MODES, type PracticeMode } from "../practiceData.ts";
import {
  PHASE_NEXT,
  PHASE_QUESTION,
  type PracticeSession,
  usePracticeSession,
} from "../session.ts";

function ModeBadge({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase ring-1 ${meta.chip}`}
    >
      {meta.eyebrow}
    </span>
  );
}

function StageGrades({ session }: { session: PracticeSession }) {
  const revealed = session.phase === "revealed";
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {GRADES.map((grade) => {
        const on = session.selected === grade.key;
        const dim = session.selected != null && !on;
        const tone = !revealed
          ? "bg-white/5 text-slate-500"
          : dim
            ? "bg-slate-800 text-slate-500"
            : `${grade.bg} text-white`;
        return (
          <button
            key={grade.key}
            type="button"
            disabled={!revealed}
            onClick={() => session.select(grade.key)}
            className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl font-semibold transition ${tone} ${
              on ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""
            }`}
          >
            <span className="flex items-center gap-2 text-sm">
              {grade.label}
              <kbd className="rounded bg-black/25 px-1.5 text-[10px] font-normal">
                {grade.hotkey}
              </kbd>
            </span>
            <span className="text-[10px] font-normal opacity-70">{grade.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function NextButton({ session, className = "" }: { session: PracticeSession; className?: string }) {
  return (
    <button
      type="button"
      onClick={session.next}
      disabled={!session.canNext}
      className={`rounded-xl bg-accent-500 px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-40 ${className}`}
    >
      {PHASE_NEXT[session.phase]} →
    </button>
  );
}

function StageDesktop({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? keyedOccurrences([...item.simplified], (c) => c) : [];

  if (session.finished || !item) {
    return (
      <div className={`flex h-[720px] flex-col rounded-[2rem] bg-gradient-to-b ${meta.band} p-3`}>
        <div className="flex flex-1 items-center justify-center rounded-[1.6rem] bg-slate-950/85">
          <SummaryPanel session={session} />
        </div>
      </div>
    );
  }

  const size = tileSize(chars.length, 460);

  return (
    <div className="flex h-[720px] flex-col overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
      <section className={`relative bg-gradient-to-b ${meta.band} px-7 pt-5 pb-8`}>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/" className="text-white/80 hover:text-white">
            ← Sair
          </Link>
          <ModeBadge session={session} />
          {session.mode === "practice" && <SrsIntactChip />}
          <label className="ml-2 flex items-center gap-1.5 text-xs text-white/80">
            <input
              type="checkbox"
              checked={session.handwriting}
              onChange={(e) => session.setHandwriting(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent-500"
            />
            Escrever à mão
          </label>
          <SessionCounters session={session} className="ml-auto" />
        </div>

        <ProgressSegments items={session.items} grades={session.grades} className="mt-4" />

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="rounded-full bg-slate-950/45 px-5 py-1.5 backdrop-blur-sm">
            <Pinyin value={item.pinyin} className="text-2xl font-medium sm:text-3xl" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {chars.map(({ key: slotKey, item: char }) => (
              <FlipTile
                key={slotKey}
                char={char}
                hidden={session.phase === "prompt"}
                sizePx={size}
              />
            ))}
          </div>
          <p className="max-w-xl text-center text-lg font-semibold text-white drop-shadow">
            {item.definitions.slice(0, 3).join(" · ")}
          </p>
        </div>
      </section>

      <div className="relative z-10 -mt-5 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-slate-800 px-6 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10">
          <span aria-hidden>{session.phase === "revealed" ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-8 py-5">
        <ActionArea session={session} className="max-w-[150px]" />
      </div>

      <footer className="border-t border-white/10 bg-slate-900/70 px-6 py-3">
        <StageGrades session={session} />
        <div className="mt-3 flex items-center gap-4">
          <button
            type="button"
            onClick={session.rollback}
            disabled={!session.canRollback}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-30"
          >
            ↩ Rollback
          </button>
          <KeyboardLegend className="hidden xl:block" />
          <NextButton session={session} className="ml-auto" />
        </div>
      </footer>
    </div>
  );
}

function StageMobile({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? keyedOccurrences([...item.simplified], (c) => c) : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className={`flex h-full flex-col justify-center bg-gradient-to-b ${meta.band}`}>
        <SummaryPanel session={session} />
      </div>
    );
  }

  const size = tileSize(chars.length, 300);

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <section
        className={`bg-gradient-to-b ${meta.band} px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-6`}
      >
        <div className="flex items-center gap-2 text-xs">
          <Link to="/" className="text-white/80">
            ← Sair
          </Link>
          <ModeBadge session={session} />
          {session.mode === "practice" && <SrsIntactChip />}
          <SessionCounters session={session} className="ml-auto" />
        </div>
        <ProgressSegments items={session.items} grades={session.grades} className="mt-3" />
        <div className="mt-4 flex flex-col items-center gap-3">
          <span className="rounded-full bg-slate-950/45 px-3 py-0.5">
            <Pinyin value={item.pinyin} className="text-lg font-medium" />
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {chars.map(({ key: slotKey, item: char }) => (
              <FlipTile
                key={slotKey}
                char={char}
                hidden={session.phase === "prompt"}
                sizePx={size}
              />
            ))}
          </div>
          <p className="text-center text-sm font-semibold text-white">
            {item.definitions.slice(0, 2).join(" · ")}
          </p>
        </div>
      </section>

      <div className="flex-1 overflow-y-auto px-4 pt-3">
        <p className="flex items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-100">
          <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </p>
        <div className="mt-3 flex justify-center">
          <ActionArea session={session} className="w-32" />
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-900/95 px-3 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-2">
          {GRADES.map((grade) => {
            const on = session.selected === grade.key;
            const dim = session.selected != null && !on;
            const tone = !revealed
              ? "bg-white/5 text-slate-500"
              : dim
                ? "bg-slate-800 text-slate-500"
                : `${grade.bg} text-white`;
            return (
              <button
                key={grade.key}
                type="button"
                disabled={!revealed}
                onClick={() => session.select(grade.key)}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold ${tone} ${
                  on ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""
                }`}
              >
                {grade.label}
                <span className="rounded bg-black/25 px-1 text-[10px] font-normal">
                  {grade.hotkey}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={session.rollback}
            disabled={!session.canRollback}
            className="grid h-11 w-12 place-items-center rounded-lg bg-white/5 text-slate-300 disabled:opacity-30"
            aria-label="Rollback"
          >
            ↩
          </button>
          <NextButton session={session} className="h-11 flex-1 rounded-lg py-0" />
        </div>
        <div className="mx-auto mt-2 h-1 w-24 rounded-full bg-white/25" />
      </div>
    </div>
  );
}

export function StagePractice({ mode }: { mode: PracticeMode }) {
  const session = usePracticeSession(mode);
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Variante A — Palco · desktop
          </p>
          <div className="mt-3">
            <StageDesktop session={session} />
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
            <PhoneFrame caption="Bandas full-bleed, dock fixo 2×2 no polegar e alvos de 44px; o resto rola por dentro.">
              <StageMobile session={session} />
            </PhoneFrame>
          </div>
        </div>
      </div>
      <Toast message={session.toast} />
    </>
  );
}
