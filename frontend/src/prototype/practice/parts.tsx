// Throwaway prototype parts (wayfinder ticket #111 — practice surfaces). Shared
// only where the variants agree: the flip tile, the mock writing pad and stroke
// panel, the session progress strip, the summary and the toast. Layout is never
// shared — each variant owns its own structure.

import type { PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import type { SrsRating } from "../../api/types.ts";
import { keyedOccurrences } from "../../lib/occurrenceKeys.ts";
import { summaryCopy } from "../../lib/quizPractice.ts";
import { Icon } from "../icons.tsx";
import { type MockQuizItem, RATING_TONE } from "./practiceData.ts";
import type { PracticeSession } from "./session.ts";

/**
 * One flip card holding a single character. The whole set flips together (same
 * `hidden`) — the front shows the character, the back a dashed "?".
 */
export function FlipTile({
  char,
  hidden,
  sizePx,
}: {
  char: string;
  hidden: boolean;
  sizePx: number;
}) {
  // Same corner *shape* at every size: a proportional radius with a cap, so a
  // 50px tile reads as a rounded square instead of collapsing into a circle.
  const radius = Math.min(20, Math.max(6, Math.round(sizePx * 0.16)));
  return (
    <div style={{ perspective: "1200px" }}>
      <div
        style={{ width: sizePx, height: sizePx }}
        className={`relative transition-transform duration-500 [transform-style:preserve-3d] [will-change:transform] ${
          hidden ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
        }`}
      >
        <div
          style={{ borderRadius: radius }}
          className="absolute inset-0 flex items-center justify-center border border-white/25 bg-white/10 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm [backface-visibility:hidden]"
        >
          <span
            lang="zh-Hans"
            className="font-hanzi leading-none text-white"
            style={{ fontSize: sizePx * 0.6 }}
          >
            {char}
          </span>
        </div>
        <div
          style={{ borderRadius: radius }}
          className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/40 bg-slate-950/20 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <span
            aria-hidden
            lang="zh-Hans"
            className="font-hanzi leading-none text-white/50 select-none"
            style={{ fontSize: sizePx * 0.5 }}
          >
            ?
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * One word's characters as flip tiles, sized to the frame it lives in. The row
 * shrinks per character down to `min`, then wraps into balanced rows, so a
 * five-character word stays legible instead of turning into confetti.
 */
export function FlipCards({
  chars,
  hidden,
  available,
  min = 56,
  cap = 132,
  gap = 10,
}: {
  chars: string[];
  hidden: boolean;
  available: number;
  min?: number;
  cap?: number;
  gap?: number;
}) {
  const count = Math.max(1, chars.length);
  let perRow = count;
  let size = Math.min(cap, Math.floor((available - (perRow - 1) * gap) / perRow));
  while (size < min && perRow > 1) {
    perRow = Math.ceil(perRow / 2);
    const widest = Math.min(perRow, count);
    size = Math.min(cap, Math.floor((available - (widest - 1) * gap) / widest));
  }
  const rows: string[][] = [];
  for (let i = 0; i < chars.length; i += perRow) rows.push(chars.slice(i, i + perRow));

  return (
    <div className="flex flex-col items-center gap-2">
      {keyedOccurrences(rows, (row) => row.join("")).map(({ key: rowKey, item: row }) => (
        <div key={rowKey} className="flex items-center justify-center" style={{ gap }}>
          {keyedOccurrences(row, (char) => char).map(({ key: charKey, item: char }) => (
            <FlipTile key={charKey} char={char} hidden={hidden} sizePx={size} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Stand-in for HandwritingQuiz: a paper grid you can scribble on, so the layout
 * can be judged with ink in it. No recognition, no tolerance, no API.
 */
export function WritePad({
  character,
  className = "",
}: {
  character: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const paint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (e.type === "pointerdown") {
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (!e.buttons) return;
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          lang="zh-Hans"
          className="font-hanzi text-7xl leading-none text-white/[0.06] select-none"
        >
          {character}
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.08) 50%, transparent 52%), linear-gradient(-45deg, transparent 48%, rgba(255,255,255,0.08) 50%, transparent 52%)",
          backgroundSize: "50% 50%, 50% 50%, 100% 100%, 100% 100%",
        }}
      />
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        onPointerDown={paint}
        onPointerMove={paint}
        className="relative h-full w-full touch-none rounded-2xl border border-white/15 bg-slate-950/40"
      />
      <button
        type="button"
        onClick={clear}
        className="absolute right-2 bottom-2 rounded-md bg-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/20"
      >
        limpar
      </button>
    </div>
  );
}

/** Stand-in for StrokeOrderPanel: the glyph grid plus traço controls. */
export function StrokeMock({
  word,
  sizePx = 200,
  className = "",
}: {
  word: string;
  sizePx?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        style={{ maxWidth: sizePx }}
        className="relative grid aspect-square w-full place-items-center rounded-2xl border border-white/10 bg-slate-950/50"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "50% 50%",
          }}
        />
        <span
          lang="zh-Hans"
          className="font-hanzi leading-none text-slate-100"
          style={{ fontSize: Math.min(96, Math.round(170 / Math.max(1, word.length))) }}
        >
          {word}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <span className="rounded bg-white/10 px-2 py-0.5">◀</span>
        <span className="tabular-nums">traço 3/8</span>
        <span className="rounded bg-white/10 px-2 py-0.5">▶</span>
      </div>
    </div>
  );
}

/** What sits under the question strip: study, write, or review the strokes. */
export function ActionArea({
  session,
  className = "",
}: {
  session: PracticeSession;
  className?: string;
}) {
  const item = session.item;
  if (!item) return null;
  if (session.phase === "prompt" && session.handwriting) {
    return <WritePad character={item.simplified[0]} className={`aspect-square ${className}`} />;
  }
  if (session.phase === "prompt") {
    return (
      <p className={`text-center text-xs text-slate-400 ${className}`}>
        Escrita à mão desligada — use “Revelar” para ver e avaliar.
      </p>
    );
  }
  return <StrokeMock word={item.simplified} className={className} />;
}

/** One segment per queue item, coloured by the grade it received. */
export function ProgressSegments({
  items,
  grades,
  className = "",
}: {
  items: MockQuizItem[];
  grades: SrsRating[];
  className?: string;
}) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {items.map((item, i) => {
        const grade = grades[i];
        const tone = grade
          ? RATING_TONE[grade]
          : i === grades.length
            ? "bg-white/45"
            : "bg-white/10";
        return <span key={item.id} className={`h-1 flex-1 rounded-full ${tone}`} />;
      })}
    </div>
  );
}

export function SessionCounters({
  session,
  className = "",
}: {
  session: PracticeSession;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-4 text-xs text-white/85 tabular-nums ${className}`}
      aria-label="Progresso da sessão"
    >
      <span title="Concluídos">✓ {session.done}</span>
      <span title="Restantes">☰ {session.remaining}</span>
      {session.mode === "review" && <span title="Acertos">👍 {session.accuracy}%</span>}
    </div>
  );
}

/** The "nothing was recorded" badge practice carries instead of a write flag. */
export function SrsIntactChip({ className = "" }: { className?: string }) {
  return (
    <span
      title="Prática não registrada — seu SRS não muda"
      className={`rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/90 uppercase ${className}`}
    >
      SRS intacto
    </span>
  );
}

export function KeyboardLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] text-slate-500 ${className}`}>
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">1–4</kbd> avaliar
      <span className="mx-2">·</span>
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">⌫</kbd> desfazer
      <span className="mx-2">·</span>
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">⏎</kbd> continuar
      <span className="mx-2">·</span>
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">Esc</kbd> sair
    </p>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-100 shadow-xl ring-1 ring-white/10">
      {message}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-3xl font-semibold text-white tabular-nums">{value}</div>
      <div className="text-[10px] tracking-wide text-slate-400 uppercase">{label}</div>
    </div>
  );
}

export function SummaryPanel({ session }: { session: PracticeSession }) {
  const copy = summaryCopy(
    session.mode === "lesson" ? "lesson" : "review",
    session.mode !== "practice",
  );
  return (
    <div className="flex flex-col items-center gap-6 px-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
        <Icon name="check" className="h-7 w-7 text-emerald-400" />
      </div>
      <h2 className="text-2xl font-semibold text-white">{copy.title}</h2>
      <div className="flex gap-10">
        <Metric label={copy.doneLabel} value={session.done} />
        {session.mode === "review" && <Metric label="Acertos" value={session.correct} />}
        {session.mode === "review" && <Metric label="Precisão" value={`${session.accuracy}%`} />}
      </div>
      {copy.note && <p className="max-w-xs text-sm text-slate-400">{copy.note}</p>}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={session.restart}
          className="rounded-lg bg-white/10 px-5 py-2 text-sm font-medium text-slate-100 hover:bg-white/15"
        >
          Recomeçar
        </button>
        <Link
          to="/"
          className="rounded-lg bg-accent-500 px-5 py-2 text-sm font-semibold text-white hover:bg-accent-600"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
