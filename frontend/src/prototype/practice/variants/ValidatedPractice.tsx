// Variant H — "Palco validado" (wayfinder #111, validation pass). A's desktop
// stage and A's mobile shell, with three fixes: mobile controls are B's (one row
// of notes, a full-width advance, rollback as an icon in the top bar); the word
// is rendered once per phase — the stroke player *replaces* the cards instead of
// sitting under the same glyph, so info shows the player, prompt the hidden
// cards, and the reveal the cards with an on-demand "Traços" swap; and the
// revealed middle shows the grade's SRS consequence instead of a second glyph.
// The queue now reaches a 7-character word.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import {
  FlipCards,
  KeyboardLegend,
  ProgressSegments,
  SessionCounters,
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

function Consequence({ session }: { session: PracticeSession }) {
  const grade = GRADES.find((g) => g.key === session.selected);
  return (
    <div className="text-center">
      {grade ? (
        <>
          <p className="text-sm font-semibold text-slate-100">
            {grade.label}
            <span className="ml-2 text-xs font-normal text-slate-400">{grade.hint}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            “Próximo” confirma a nota e avança. “Rollback” limpa a nota.
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          Escolha uma nota — o cartão já está revelado, nada foi gravado ainda.
        </p>
      )}
    </div>
  );
}

/** The single glyph slot: cards, or the stroke player when it is turned on. */
function GlyphSlot({
  session,
  chars,
  available,
  min,
  showPlayer,
  playerSize,
}: {
  session: PracticeSession;
  chars: string[];
  available: number;
  min?: number;
  showPlayer: boolean;
  playerSize: number;
}) {
  const item = session.item;
  if (!item) return null;
  if (showPlayer) return <StrokeMock word={item.simplified} sizePx={playerSize} />;
  return (
    <FlipCards chars={chars} hidden={session.phase === "prompt"} available={available} min={min} />
  );
}

function StrokeToggle({
  session,
  on,
  onToggle,
}: {
  session: PracticeSession;
  on: boolean;
  onToggle: () => void;
}) {
  if (session.phase !== "revealed") return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full bg-slate-950/35 px-3 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/20 hover:bg-slate-950/55"
    >
      {on ? "← Cartões" : "Ver traços →"}
    </button>
  );
}

function ValidatedDesktop({
  session,
  playerOn,
  onToggle,
}: {
  session: PracticeSession;
  playerOn: boolean;
  onToggle: () => void;
}) {
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
    <div className="flex h-[720px] flex-col overflow-hidden rounded-[2rem] bg-slate-950 ring-1 ring-white/10">
      <section className={`relative bg-gradient-to-b ${meta.band} px-7 pt-5 pb-8`}>
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

        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="rounded-full bg-slate-950/45 px-5 py-1.5 backdrop-blur-sm">
            <Pinyin value={item.pinyin} className="text-2xl font-medium sm:text-3xl" />
          </div>
          <GlyphSlot
            session={session}
            chars={chars}
            available={430}
            min={40}
            showPlayer={session.phase === "info" || (revealed && playerOn)}
            playerSize={240}
          />
          <p className="max-w-xl text-center text-lg font-semibold text-white drop-shadow">
            {item.definitions.slice(0, 3).join(" · ")}
          </p>
          <StrokeToggle session={session} on={playerOn} onToggle={onToggle} />
        </div>
      </section>

      <div className="relative z-10 -mt-5 flex justify-center">
        <div className="flex items-center gap-2 rounded-full bg-slate-800 px-6 py-2 text-sm font-medium text-slate-100 ring-1 ring-white/10">
          <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-8 py-4">
        {session.phase === "prompt" ? (
          session.handwriting ? (
            <div className="w-[170px]">
              <WritePad character={item.simplified[0]} className="aspect-square" />
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400">
              Escrita à mão desligada — use “Revelar” para avaliar.
            </p>
          )
        ) : revealed ? (
          <Consequence session={session} />
        ) : (
          <p className="text-center text-xs text-slate-400">
            Memorize os traços acima — a seguir você escreve de memória.
          </p>
        )}
      </div>

      <footer className="border-t border-white/10 bg-slate-900/70 px-6 py-3">
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
          <button
            type="button"
            onClick={session.next}
            disabled={!session.canNext}
            className="ml-auto rounded-xl bg-accent-500 px-7 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-40"
          >
            {PHASE_NEXT[session.phase]} →
          </button>
        </div>
      </footer>
    </div>
  );
}

function ValidatedMobile({
  session,
  playerOn,
  onToggle,
}: {
  session: PracticeSession;
  playerOn: boolean;
  onToggle: () => void;
}) {
  const meta = MODES[session.mode];
  const item = session.item;
  const chars = item ? [...item.simplified] : [];
  const revealed = session.phase === "revealed";

  if (session.finished || !item) {
    return (
      <div className={`flex h-full flex-col justify-center bg-gradient-to-b ${meta.band}`}>
        <SummaryPanel session={session} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <section
        className={`bg-gradient-to-b ${meta.band} px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-6`}
      >
        <div className="flex items-center gap-2 text-xs">
          <Link to="/" className="text-white/80">
            ← Sair
          </Link>
          <span className="rounded-full bg-slate-950/30 px-2 py-0.5 text-[9px] font-semibold tracking-widest uppercase ring-1 ring-white/20">
            {meta.eyebrow}
          </span>
          {session.mode === "practice" && <SrsIntactChip />}
          <SessionCounters session={session} className="ml-auto text-[10px]" />
          <button
            type="button"
            onClick={session.rollback}
            disabled={!session.canRollback}
            aria-label="Rollback"
            className="rounded-md px-1 text-sm text-white/80 disabled:opacity-30"
          >
            ↩
          </button>
        </div>
        <ProgressSegments items={session.items} grades={session.grades} className="mt-3" />
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="rounded-full bg-slate-950/45 px-3 py-0.5">
            <Pinyin value={item.pinyin} className="text-lg font-medium" />
          </span>
          <GlyphSlot
            session={session}
            chars={chars}
            available={300}
            min={40}
            showPlayer={session.phase === "info" || (revealed && playerOn)}
            playerSize={190}
          />
          <p className="text-center text-sm font-semibold text-white">
            {item.definitions.slice(0, 2).join(" · ")}
          </p>
          <StrokeToggle session={session} on={playerOn} onToggle={onToggle} />
        </div>
      </section>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-3">
        <p className="flex items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-100">
          <span aria-hidden>{revealed ? "✅" : "✍️"}</span>
          {PHASE_QUESTION[session.phase]}
        </p>
        {session.phase === "prompt" ? (
          session.handwriting ? (
            <div className="w-[150px]">
              <WritePad character={item.simplified[0]} className="aspect-square" />
            </div>
          ) : (
            <p className="text-center text-[11px] text-slate-400">
              Escrita à mão desligada — use “Revelar” para avaliar.
            </p>
          )
        ) : revealed ? (
          <Consequence session={session} />
        ) : (
          <p className="px-4 text-center text-[11px] text-slate-400">
            Memorize os traços acima — a seguir você escreve de memória.
          </p>
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-900/95 px-3 pt-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
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

export function ValidatedPractice({ mode }: { mode: PracticeMode }) {
  const session = usePracticeSession(mode);
  const [playerFor, setPlayerFor] = useState<number | null>(null);
  const itemId = session.item?.id ?? null;
  const playerOn = playerFor != null && playerFor === itemId;
  const togglePlayer = () => {
    if (itemId == null) return;
    setPlayerFor((cur) => (cur === itemId ? null : itemId));
  };
  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <div className="mx-auto max-w-6xl px-6 pt-8">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Variante H — Palco validado · desktop
          </p>
          <div className="mt-3">
            <ValidatedDesktop session={session} playerOn={playerOn} onToggle={togglePlayer} />
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
            <PhoneFrame caption="Palco no celular com os controles da Bancada: nota em uma linha, avançar em largura total e ↩ no topo. O glifo aparece uma vez por fase.">
              <ValidatedMobile session={session} playerOn={playerOn} onToggle={togglePlayer} />
            </PhoneFrame>
          </div>
        </div>
      </div>
      <Toast message={session.toast} />
    </>
  );
}
