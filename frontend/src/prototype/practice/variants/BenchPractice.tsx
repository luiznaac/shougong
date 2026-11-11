// Variant B — "Bancada" (wayfinder #111). The coloured band is demoted from a
// full-bleed block to a vertical ribbon plus tinted accents, and the desktop
// gains a real instrument panel: session facts and the four grades live in a
// right rail, while the left column is the "page" (pinyin, cards, meaning and
// the writing paper). Mobile collapses the rail into a compact header strip and
// a one-row grade strip above a full-width advance button.

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

function Metric({
  label,
  value,
  tone = "text-slate-100",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-950/50 px-3 py-2 ring-1 ring-white/5">
      <div className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[9px] tracking-wide text-slate-500 uppercase">{label}</div>
    </div>
  );
}

function BenchDesktop({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className="flex h-[720px] flex-col justify-center rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
        <SummaryPanel session={session} />
      </div>
    );
  }

  return (
    <div className="grid h-[720px] grid-cols-[1.15fr_0.85fr] overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
      <section className="relative flex flex-col border-r border-white/10">
        <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${meta.band}`} />
        <header className="flex items-center gap-3 px-8 pt-6 text-sm">
          <Link to="/" className="text-slate-400 hover:text-slate-200">
            ← Sair
          </Link>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase ring-1 ${meta.chip}`}
          >
            {meta.eyebrow}
          </span>
          <span className="text-xs text-slate-500 tabular-nums">
            item {session.index + 1} de {session.items.length}
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 py-6">
          <Pinyin value={item.pinyin} className="text-4xl font-medium" />
          <FlipCards chars={chars} hidden={session.phase === "prompt"} available={460} />
          <p className="text-center text-xl font-semibold text-slate-200">
            {item.definitions.slice(0, 3).join(" · ")}
          </p>
          <ActionArea session={session} className="max-w-[200px]" />
        </div>
      </section>

      <aside className="flex flex-col gap-4 bg-slate-900/60 p-6">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
              Sessão
            </h2>
            {session.mode === "practice" && <SrsIntactChip />}
          </div>
          <ProgressSegments items={session.items} grades={session.grades} className="mt-2" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Concluídos" value={session.done} />
            <Metric label="Restantes" value={session.remaining} />
            {session.mode === "review" ? (
              <Metric label="Precisão" value={`${session.accuracy}%`} tone="text-emerald-300" />
            ) : (
              <Metric label="Itens" value={session.items.length} />
            )}
          </div>
        </div>

        <div className="rounded-xl bg-slate-800/60 px-4 py-3 ring-1 ring-white/10">
          <p className="text-[10px] tracking-widest text-slate-400 uppercase">Pergunta</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
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
                ? "bg-slate-800/60 text-slate-500"
                : `${grade.bg} text-white`;
            return (
              <button
                key={grade.key}
                type="button"
                disabled={!revealed}
                onClick={() => session.select(grade.key)}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-left transition ${tone} ${
                  on ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""
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
        </div>
      </aside>
    </div>
  );
}

function BenchMobile({ session }: { session: PracticeSession }) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className="flex h-full flex-col justify-center bg-slate-950">
        <SummaryPanel session={session} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div className={`h-1 shrink-0 bg-gradient-to-r ${meta.band}`} />
      <header className="flex items-center gap-2 px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-2 text-xs">
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
          {session.mode === "review" && ` · 👍 ${session.accuracy}%`}
        </span>
        <button
          type="button"
          onClick={session.rollback}
          disabled={!session.canRollback}
          aria-label="Rollback"
          className="rounded-md px-1.5 py-0.5 text-sm text-slate-300 disabled:opacity-30"
        >
          ↩
        </button>
      </header>
      <ProgressSegments items={session.items} grades={session.grades} className="mx-4" />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-3">
        <Pinyin value={item.pinyin} className="text-2xl font-medium" />
        <FlipCards chars={chars} hidden={session.phase === "prompt"} available={300} />
        <p className="text-center text-sm font-semibold text-slate-200">
          {item.definitions.slice(0, 2).join(" · ")}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </p>
        <ActionArea session={session} className="w-36" />
      </div>

      <div className="border-t border-white/10 bg-slate-900/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1.5">
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
                className={`h-12 flex-1 rounded-lg text-[11px] font-semibold ${tone} ${
                  on ? "ring-2 ring-white" : ""
                }`}
              >
                {grade.label}
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

export function BenchPractice({ mode }: { mode: PracticeMode }) {
  const session = usePracticeSession(mode);
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Variante B — Bancada · desktop
          </p>
          <div className="mt-3">
            <BenchDesktop session={session} />
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
            <PhoneFrame caption="Faixa colorida vira ribbon de 4px, notas em uma linha só e avançar em largura total no polegar.">
              <BenchMobile session={session} />
            </PhoneFrame>
          </div>
        </div>
      </div>
      <Toast message={session.toast} />
    </>
  );
}
