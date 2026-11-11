// Variant C — "Cartão" (wayfinder #111). The desktop answer to a full-screen
// runner: do not fill the screen. Everything the session needs fits in one
// bounded card floating on an ambient backdrop — the coloured band becomes the
// card's header strip, the queue becomes a dot strip under it, and the keyboard
// legend is always visible. Mobile makes the card the screen, with a single-row
// thumb toolbar (rollback · 1–4 · next) above the safe area.

import { Link } from "react-router-dom";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { keyedOccurrences } from "../../../lib/occurrenceKeys.ts";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import {
  ActionArea,
  FlipTile,
  KeyboardLegend,
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

function SessionDots({ session }: { session: PracticeSession }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="Itens da sessão">
      {session.items.map((item, i) => {
        const graded = i < session.grades.length;
        const current = i === session.index;
        return (
          <span
            key={item.id}
            className={`h-1.5 rounded-full transition-all ${
              current ? "w-6 bg-white/80" : graded ? "w-1.5 bg-white/40" : "w-1.5 bg-white/15"
            }`}
          />
        );
      })}
    </div>
  );
}

function CardGrades({ session }: { session: PracticeSession }) {
  const revealed = session.phase === "revealed";
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map((grade) => {
        const on = session.selected === grade.key;
        const dim = session.selected != null && !on;
        const tone = !revealed
          ? "bg-white/5 text-slate-500"
          : dim
            ? "bg-slate-800/70 text-slate-500"
            : `${grade.bg} text-white`;
        return (
          <button
            key={grade.key}
            type="button"
            disabled={!revealed}
            onClick={() => session.select(grade.key)}
            className={`flex h-14 flex-col items-center justify-center rounded-xl text-xs font-semibold transition ${tone} ${
              on ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""
            }`}
          >
            <span className="flex items-center gap-1.5">
              {grade.label}
              <span className="rounded bg-black/25 px-1 text-[9px] font-normal">
                {grade.hotkey}
              </span>
            </span>
            <span className="text-[9px] font-normal opacity-70">{grade.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function CardDesktop({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? keyedOccurrences([...item.simplified], (c) => c) : [];

  if (session.finished || !item) {
    return (
      <div className="relative flex h-[720px] items-center justify-center overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
        <div className="relative w-[680px] rounded-[1.75rem] bg-slate-900/70 py-12 ring-1 ring-white/10 shadow-2xl backdrop-blur">
          <SummaryPanel session={session} />
        </div>
      </div>
    );
  }

  const size = tileSize(chars.length, 400);

  return (
    <div className="relative flex h-[720px] flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${meta.band} opacity-[0.13]`}
      />
      <span
        aria-hidden
        lang="zh-Hans"
        className="font-hanzi pointer-events-none absolute -right-10 -bottom-24 text-[26rem] leading-none text-white/[0.03] select-none"
      >
        {item.simplified[0]}
      </span>

      <div className="relative w-[680px] overflow-hidden rounded-[1.75rem] bg-slate-900/75 ring-1 ring-white/10 shadow-2xl backdrop-blur">
        <div className={`flex items-center gap-3 bg-gradient-to-r ${meta.band} px-6 py-2.5`}>
          <span className="rounded-full bg-slate-950/30 px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase">
            {meta.eyebrow}
          </span>
          <span className="text-[11px] text-white/70 tabular-nums">
            item {session.index + 1} de {session.items.length}
          </span>
          {session.mode === "practice" && <SrsIntactChip />}
          <SessionCounters session={session} className="ml-auto" />
          <Link
            to="/"
            aria-label="Sair"
            className="rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Icon name="close" className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-3 px-8 pt-6">
          <Pinyin value={item.pinyin} className="text-3xl font-medium" />
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {chars.map(({ key: slotKey, item: char }) => (
              <FlipTile
                key={slotKey}
                char={char}
                hidden={session.phase === "prompt"}
                sizePx={size}
              />
            ))}
          </div>
          <p className="text-center text-base font-semibold text-slate-200">
            {item.definitions.slice(0, 3).join(" · ")}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center px-8">
          <ActionArea session={session} className="w-32" />
        </div>

        <div className="mt-4 border-t border-white/10 px-6 py-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <span aria-hidden>{session.phase === "revealed" ? "✅" : "✍️"}</span>
            {PHASE_QUESTION[session.phase]}
          </p>
          <CardGrades session={session} />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={session.rollback}
              disabled={!session.canRollback}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 disabled:opacity-30"
            >
              ↩ Rollback
            </button>
            <button
              type="button"
              onClick={session.next}
              disabled={!session.canNext}
              className="ml-auto rounded-lg bg-accent-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-40"
            >
              {PHASE_NEXT[session.phase]} →
            </button>
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex items-center gap-5">
        <SessionDots session={session} />
        <KeyboardLegend />
      </div>
    </div>
  );
}

function CardMobile({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? keyedOccurrences([...item.simplified], (c) => c) : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className="flex h-full flex-col justify-center bg-slate-950">
        <SummaryPanel session={session} />
      </div>
    );
  }

  const size = tileSize(chars.length, 290);

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div
        className={`flex items-center gap-2 bg-gradient-to-r ${meta.band} px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-2`}
      >
        <span className="rounded-full bg-slate-950/30 px-2 py-0.5 text-[9px] font-semibold tracking-widest uppercase">
          {meta.eyebrow}
        </span>
        <span className="text-[10px] text-white/70 tabular-nums">
          {session.index + 1}/{session.items.length}
        </span>
        {session.mode === "practice" && <SrsIntactChip />}
        <SessionCounters session={session} className="ml-auto text-[10px]" />
        <Link to="/" aria-label="Sair" className="text-white/80">
          <Icon name="close" className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
        <Pinyin value={item.pinyin} className="text-2xl font-medium" />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {chars.map(({ key: slotKey, item: char }) => (
            <FlipTile key={slotKey} char={char} hidden={session.phase === "prompt"} sizePx={size} />
          ))}
        </div>
        <p className="text-center text-sm font-semibold text-slate-200">
          {item.definitions.slice(0, 2).join(" · ")}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </p>
        <ActionArea session={session} className="w-32" />
        <SessionDots session={session} />
      </div>

      <div className="border-t border-white/10 bg-slate-900/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-stretch gap-1">
          <button
            type="button"
            onClick={session.rollback}
            disabled={!session.canRollback}
            aria-label="Rollback"
            className="grid w-10 place-items-center rounded-lg bg-white/5 text-slate-300 disabled:opacity-30"
          >
            ↩
          </button>
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
                className={`h-12 flex-1 rounded-lg text-[10px] font-semibold ${tone} ${
                  on ? "ring-2 ring-white" : ""
                }`}
              >
                {grade.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={session.next}
            disabled={!session.canNext}
            aria-label={PHASE_NEXT[session.phase]}
            className="grid w-10 place-items-center rounded-lg bg-accent-500 text-white disabled:opacity-40"
          >
            →
          </button>
        </div>
        <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-white/25" />
      </div>
    </div>
  );
}

export function CardPractice({ mode }: { mode: PracticeMode }) {
  const session = usePracticeSession(mode);
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Variante C — Cartão · desktop
          </p>
          <div className="mt-3">
            <CardDesktop session={session} />
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
            <PhoneFrame caption="O cartão vira a tela; barra única de polegar (↩ · 1–4 · →) acima da safe area.">
              <CardMobile session={session} />
            </PhoneFrame>
          </div>
        </div>
      </div>
      <Toast message={session.toast} />
    </>
  );
}
