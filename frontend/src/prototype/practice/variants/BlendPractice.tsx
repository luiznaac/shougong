// Variant E — "Palco com painel" (wayfinder #111, blend pass). Takes the three
// winners literally: A's full-width coloured band and bounded stage, B's
// instrument rail, C's single-card framing. Desktop keeps the band on the left
// two thirds and turns B's panel into the right third of the same card; mobile
// reuses A's full-bleed band and two-by-two thumb dock unchanged.

import { Link } from "react-router-dom";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import {
  ActionArea,
  FlipCards,
  KeyboardLegend,
  ProgressSegments,
  SessionCounters,
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
import { StageMobile } from "./StagePractice.tsx";

function PanelMetric({
  label,
  value,
  tone = "text-slate-100",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-950/60 px-3 py-2 ring-1 ring-white/5">
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[9px] tracking-wide text-slate-500 uppercase">{label}</div>
    </div>
  );
}

function BlendDesktop({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className={`flex h-[720px] flex-col rounded-[2rem] bg-gradient-to-b ${meta.band} p-3`}>
        <div className="flex flex-1 items-center justify-center rounded-[1.6rem] bg-slate-950/85">
          <SummaryPanel session={session} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-[720px] grid-cols-[1fr_320px] overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
      <section className={`relative flex flex-col bg-gradient-to-b ${meta.band} px-8 pt-5 pb-8`}>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/" className="text-white/80 hover:text-white">
            ← Sair
          </Link>
          <span className="rounded-full bg-slate-950/30 px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase ring-1 ring-white/20">
            {meta.eyebrow}
          </span>
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

        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="rounded-full bg-slate-950/45 px-5 py-1.5 backdrop-blur-sm">
            <Pinyin value={item.pinyin} className="text-2xl font-medium sm:text-3xl" />
          </div>
          <FlipCards chars={chars} hidden={session.phase === "prompt"} available={430} />
          <p className="max-w-md text-center text-lg font-semibold text-white drop-shadow">
            {item.definitions.slice(0, 3).join(" · ")}
          </p>
          <ActionArea session={session} className="max-w-[150px]" />
        </div>
      </section>

      <aside className="flex flex-col gap-4 bg-slate-950 p-5 ring-1 ring-white/5">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
              Sessão
            </h2>
            <span className="text-[11px] text-slate-500 tabular-nums">
              item {session.index + 1} de {session.items.length}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <PanelMetric label="Concluídos" value={session.done} />
            <PanelMetric label="Restantes" value={session.remaining} />
            {session.mode === "review" ? (
              <PanelMetric
                label="Precisão"
                value={`${session.accuracy}%`}
                tone="text-emerald-300"
              />
            ) : (
              <PanelMetric label="Itens" value={session.items.length} />
            )}
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/70 px-4 py-3 ring-1 ring-white/10">
          <p className="text-[10px] tracking-widest text-slate-500 uppercase">Pergunta</p>
          <p className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-100">
            <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
            {PHASE_QUESTION[session.phase]}
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-2">
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
  );
}

export function BlendPractice({ mode }: { mode: PracticeMode }) {
  const session = usePracticeSession(mode);
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Variante E — Palco com painel · desktop
          </p>
          <div className="mt-3">
            <BlendDesktop session={session} />
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
            <PhoneFrame caption="Mobile igual à variante A: banda full-bleed e dock 2×2 no polegar.">
              <StageMobile session={session} />
            </PhoneFrame>
          </div>
        </div>
      </div>
      <Toast message={session.toast} />
    </>
  );
}
