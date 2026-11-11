// Throwaway prototype parts (wayfinder ticket #110 — study item detail).
// Shared low-level pieces only: the adopted shell (#105), the SRS chips, the
// trajectory chart, snapshot/related rows and the paging primitives. Each
// variant owns its own page structure.

import { useState } from "react";
import type { ReactNode } from "react";
import { Hanzi } from "../../components/Hanzi.tsx";
import { Pinyin } from "../../components/Pinyin.tsx";
import { levelColor, levelLabel, levelOf } from "../../lib/srs.ts";
import { Icon } from "../icons.tsx";
import {
  FORMAT_LABEL,
  type MockItem,
  type MockReading,
  type MockRelated,
  type MockSnapshot,
  STATE_LABEL,
  STROKES,
} from "./itemDetailData.ts";

const NAV = ["Hoje", "Biblioteca", "Leitura", "Progresso"];

/** Desktop app shell adopted from #105, with Biblioteca active. */
export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-7 px-6">
          <div className="flex items-center gap-2">
            <span lang="zh-Hans" className="font-hanzi text-xl text-accent-500">
              手工
            </span>
            <span className="text-sm font-semibold tracking-wide text-slate-300">shougong</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((label) => (
              <span
                key={label}
                className={`cursor-default rounded-md px-3 py-1.5 text-sm font-medium ${
                  label === "Biblioteca"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">
              <Icon name="search" className="h-4 w-4" />
              Buscar
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</kbd>
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-xs text-slate-300">
              LN
            </span>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

/** Mobile app shell adopted from #105 (top bar + bottom tabs, Biblioteca active). */
export function MobileChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-2">
          <span lang="zh-Hans" className="font-hanzi text-lg text-accent-500">
            手工
          </span>
          <span className="text-xs font-semibold tracking-wide text-slate-400">shougong</span>
        </div>
        <Icon name="search" className="h-5 w-5 text-slate-400" />
      </header>
      <div className="relative flex-1 overflow-y-auto">{children}</div>
      <nav className="flex shrink-0 border-t border-white/10 bg-slate-950 px-2 pt-1 pb-2">
        {[
          ["Hoje", "home", false],
          ["Biblioteca", "book", true],
          ["Leitura", "text", false],
          ["Mais", "more", false],
        ].map(([label, icon, active]) => (
          <div
            key={String(label)}
            className={`flex flex-1 flex-col items-center gap-0.5 pt-1 ${
              active ? "text-accent-500" : "text-slate-500"
            }`}
          >
            <Icon name={String(icon)} className="h-5 w-5" />
            <span className="text-[9px]">{label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function ItemGlyph({
  item,
  singleCharPx,
  boxPx,
}: {
  item: MockItem;
  singleCharPx: number;
  boxPx: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <Pinyin value={item.entry.pinyin} className="text-sm text-slate-400" />
      <Hanzi
        text={item.entry.simplified}
        singleCharPx={singleCharPx}
        boxPx={boxPx}
        className="text-slate-50"
      />
    </div>
  );
}

export function BadgeRow({ item, className = "" }: { item: MockItem; className?: string }) {
  return (
    <span className={`flex items-center gap-1 ${className}`}>
      {item.is_leech && (
        <span
          role="img"
          aria-label="Sanguessuga"
          title="Sanguessuga"
          className="grid h-5 w-5 place-items-center rounded-full bg-slate-950/85 text-rose-300 ring-1 ring-white/10"
        >
          <Icon name="ghost" className="h-3.5 w-3.5" strokeWidth={2.6} />
        </span>
      )}
      {item.priority_position != null && (
        <span
          role="img"
          aria-label="Prioridade"
          title="Prioridade"
          className="grid h-5 w-5 place-items-center rounded-full bg-slate-950/85 text-amber-300 ring-1 ring-white/10"
        >
          <Icon name="bolt" className="h-3.5 w-3.5" strokeWidth={2.6} />
        </span>
      )}
    </span>
  );
}

export function LevelChip({ item }: { item: MockItem }) {
  const level = levelOf(item.card);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
      style={{ background: levelColor(level) }}
    >
      {levelLabel(level)}
    </span>
  );
}

export function HskChip({ level }: { level: number | null }) {
  if (level == null) return null;
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">HSK {level}</span>
  );
}

export function StateChip({ state }: { state: keyof typeof STATE_LABEL }) {
  const tone =
    state === "review"
      ? "text-emerald-300"
      : state === "relearning"
        ? "text-amber-300"
        : "text-sky-300";
  return (
    <span className={`rounded bg-white/5 px-1.5 py-0.5 text-[10px] ${tone}`}>
      {STATE_LABEL[state]}
    </span>
  );
}

/** FSRS facts as an inline strip — each variant places it differently. */
export function FactsStrip({ facts }: { facts: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
          <div className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</div>
          <div className="mt-0.5 truncate text-sm text-slate-200">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function PriorityBar({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "justify-between"}`}>
      <p className={`${compact ? "text-[11px]" : "text-sm"} text-slate-400`}>
        <span className="text-slate-200">Na fila, à frente</span> · posição 3
        {!compact && (
          <span className="block text-xs text-slate-500">
            Sobe para o topo da próxima lição; não altera o agendamento.
          </span>
        )}
      </p>
      <div className="flex items-center gap-1">
        <PriorityButton icon="arrow-right" label="À frente" tone="accent" />
        <PriorityButton icon="clock" label="Atrás" tone="plain" />
        <PriorityButton icon="trash" label="Remover" tone="plain" />
      </div>
    </div>
  );
}

function PriorityButton({
  icon,
  label,
  tone,
}: {
  icon: string;
  label: string;
  tone: "accent" | "plain";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`rounded-md p-1.5 ring-1 ring-inset transition-colors ${
        tone === "accent"
          ? "bg-accent-500/15 text-accent-300 ring-accent-500/30 hover:bg-accent-500/25"
          : "text-slate-400 ring-white/10 hover:bg-white/5 hover:text-slate-200"
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
    </button>
  );
}

/** Trajectory chart: stability (solid) and difficulty (dashed) over time. */
export function FxChart({ history, height = 176 }: { history: MockSnapshot[]; height?: number }) {
  const W = 480;
  const PAD = { top: 12, right: 12, bottom: 20, left: 12 };
  const PH = height - PAD.top - PAD.bottom;
  const PW = W - PAD.left - PAD.right;
  const rows = [...history].reverse();
  const maxStability = Math.max(1, ...rows.map((r) => r.stability));
  const t0 = new Date(rows[0].created_at).getTime();
  const t1 = new Date(rows[rows.length - 1].created_at).getTime();
  const span = Math.max(1, t1 - t0);

  const x = (t: number) => PAD.left + ((t - t0) / span) * PW;
  const yStab = (v: number) => PAD.top + PH - (v / maxStability) * PH;
  const yDiff = (v: number) => PAD.top + PH - (v / 10) * PH;

  const stab = rows.map((r) => `${x(new Date(r.created_at).getTime())},${yStab(r.stability)}`);
  const diff = rows.map((r) => `${x(new Date(r.created_at).getTime())},${yDiff(r.difficulty)}`);
  const area = `${PAD.left},${PAD.top + PH} ${stab.join(" ")} ${PAD.left + PW},${PAD.top + PH}`;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Trajetória FSRS">
      <title>Estabilidade e dificuldade ao longo do tempo</title>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={PAD.left}
          x2={PAD.left + PW}
          y1={PAD.top + PH * f}
          y2={PAD.top + PH * f}
          className="text-white/5"
          stroke="currentColor"
        />
      ))}
      <polygon points={area} fill="var(--color-accent-500)" fillOpacity="0.12" />
      <polyline
        points={stab.join(" ")}
        fill="none"
        stroke="var(--color-accent-500)"
        strokeWidth="2"
      />
      <polyline
        points={diff.join(" ")}
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

/** Trajectory chart with visible axes — no snapshot list, just the curve. */
export function FxChartAxes({
  history,
  height = 240,
}: {
  history: MockSnapshot[];
  height?: number;
}) {
  const W = 520;
  const PAD = { top: 14, right: 46, bottom: 30, left: 46 };
  const PW = W - PAD.left - PAD.right;
  const PH = height - PAD.top - PAD.bottom;
  const rows = [...history].reverse();
  const maxStability = Math.max(1, Math.ceil(Math.max(...rows.map((r) => r.stability)) / 5) * 5);
  const t0 = new Date(rows[0].created_at).getTime();
  const t1 = new Date(rows[rows.length - 1].created_at).getTime();
  const span = Math.max(1, t1 - t0);

  const x = (t: number) => PAD.left + ((t - t0) / span) * PW;
  const yStab = (v: number) => PAD.top + PH - (v / maxStability) * PH;
  const yDiff = (v: number) => PAD.top + PH - (v / 10) * PH;

  const stab = rows.map((r) => `${x(new Date(r.created_at).getTime())},${yStab(r.stability)}`);
  const diff = rows.map((r) => `${x(new Date(r.created_at).getTime())},${yDiff(r.difficulty)}`);
  const area = `${PAD.left},${PAD.top + PH} ${stab.join(" ")} ${PAD.left + PW},${PAD.top + PH}`;

  const yTicks = [0, 0.5, 1];
  const dateTicks = [0, 1 / 3, 2 / 3, 1].map((f) => {
    const t = t0 + f * span;
    return {
      x: PAD.left + f * PW,
      label: new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    };
  });

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Trajetória FSRS">
      <title>Estabilidade e dificuldade ao longo do tempo</title>

      {yTicks.map((f) => (
        <line
          key={f}
          x1={PAD.left}
          x2={PAD.left + PW}
          y1={PAD.top + PH * f}
          y2={PAD.top + PH * f}
          className="text-white/5"
          stroke="currentColor"
        />
      ))}

      {/* left axis — stability (days) */}
      <line
        x1={PAD.left}
        x2={PAD.left}
        y1={PAD.top}
        y2={PAD.top + PH}
        className="text-white/15"
        stroke="currentColor"
      />
      {yTicks.map((f) => (
        <text
          key={`sy-${f}`}
          x={PAD.left - 7}
          y={PAD.top + PH * f + 3}
          textAnchor="end"
          className="fill-accent-500 text-[9px] tabular-nums"
        >
          {Math.round(maxStability * (1 - f))}
        </text>
      ))}
      <text x={PAD.left - 7} y={PAD.top - 4} textAnchor="end" className="fill-slate-500 text-[9px]">
        dias
      </text>

      {/* right axis — difficulty (1–10) */}
      <line
        x1={PAD.left + PW}
        x2={PAD.left + PW}
        y1={PAD.top}
        y2={PAD.top + PH}
        className="text-white/15"
        stroke="currentColor"
      />
      {yTicks.map((f) => (
        <text
          key={`dy-${f}`}
          x={PAD.left + PW + 7}
          y={PAD.top + PH * f + 3}
          className="fill-sky-500 text-[9px] tabular-nums"
        >
          {(10 * (1 - f)).toFixed(0)}
        </text>
      ))}
      <text x={PAD.left + PW + 7} y={PAD.top - 4} className="fill-slate-500 text-[9px]">
        dif.
      </text>

      {/* bottom axis — dates */}
      <line
        x1={PAD.left}
        x2={PAD.left + PW}
        y1={PAD.top + PH}
        y2={PAD.top + PH}
        className="text-white/15"
        stroke="currentColor"
      />
      {dateTicks.map((tick) => (
        <g key={tick.label + tick.x}>
          <line
            x1={tick.x}
            x2={tick.x}
            y1={PAD.top + PH}
            y2={PAD.top + PH + 4}
            className="text-white/15"
            stroke="currentColor"
          />
          <text
            x={tick.x}
            y={PAD.top + PH + 15}
            textAnchor="middle"
            className="fill-slate-500 text-[9px]"
          >
            {tick.label}
          </text>
        </g>
      ))}

      <polygon points={area} fill="var(--color-accent-500)" fillOpacity="0.12" />
      <polyline
        points={stab.join(" ")}
        fill="none"
        stroke="var(--color-accent-500)"
        strokeWidth="2"
      />
      <polyline
        points={diff.join(" ")}
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
    </svg>
  );
}

/** Tiny embedded trend — trajectory as a glanceable hint, not a hero chart. */
export function Sparkline({
  history,
  width = 180,
  height = 44,
  className = "",
}: {
  history: MockSnapshot[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const rows = [...history].reverse();
  const max = Math.max(1, ...rows.map((r) => r.stability));
  const pad = 4;
  const pts = rows
    .map((r, i) => {
      const x = pad + (i / Math.max(1, rows.length - 1)) * (width - pad * 2);
      const y = pad + (1 - r.stability / max) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${pad},${height - pad} ${pts} ${width - pad},${height - pad}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Tendência de estabilidade"
    >
      <title>Tendência de estabilidade</title>
      <polygon points={area} fill="var(--color-accent-500)" fillOpacity="0.1" />
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-accent-500)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-accent-500" />
        Estabilidade
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-full bg-sky-500" />
        Dificuldade
      </span>
    </div>
  );
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export function SnapshotTable({ rows }: { rows: MockSnapshot[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead>
        <tr className="text-[10px] tracking-wide text-slate-500 uppercase">
          <th className="w-[30%] py-1.5 font-medium">Quando</th>
          <th className="w-[24%] py-1.5 font-medium">Estado</th>
          <th className="w-[16%] py-1.5 text-right font-medium">Estab.</th>
          <th className="w-[16%] py-1.5 text-right font-medium">Dific.</th>
          <th className="w-[14%] py-1.5 text-right font-medium">Próx.</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {rows.map((row) => (
          <tr key={row.created_at} className="text-slate-300">
            <td className="py-2 tabular-nums">{fmtDateTime(row.created_at)}</td>
            <td className="py-2">
              <StateChip state={row.state} />
            </td>
            <td className="py-2 text-right tabular-nums">{row.stability.toFixed(1)} d</td>
            <td className="py-2 text-right tabular-nums">{row.difficulty.toFixed(2)}</td>
            <td className="py-2 text-right tabular-nums text-slate-500">{fmtDate(row.due)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SnapshotCard({ row }: { row: MockSnapshot }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-slate-300">
          {fmtDateTime(row.created_at)}
        </span>
        <StateChip state={row.state} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-[9px] tracking-wide text-slate-500 uppercase">Estab.</div>
          <div className="text-sm tabular-nums text-slate-200">{row.stability.toFixed(1)} d</div>
        </div>
        <div>
          <div className="text-[9px] tracking-wide text-slate-500 uppercase">Dific.</div>
          <div className="text-sm tabular-nums text-slate-200">{row.difficulty.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] tracking-wide text-slate-500 uppercase">Próx.</div>
          <div className="text-sm tabular-nums text-slate-400">{fmtDate(row.due)}</div>
        </div>
      </div>
    </div>
  );
}

export function RelatedRow({ entry, action }: { entry: MockRelated; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Hanzi
        text={entry.simplified}
        singleCharPx={24}
        boxPx={72}
        className="shrink-0 text-slate-100"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Pinyin value={entry.pinyin} className="text-xs text-slate-400" />
          <HskChip level={entry.hsk_level} />
        </div>
        <p className="truncate text-[11px] text-slate-400">{entry.definitions.join("; ")}</p>
      </div>
      {action ??
        (entry.studyItemId != null ? (
          <span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-400">
            na fila
          </span>
        ) : (
          <button
            type="button"
            className="shrink-0 rounded-md bg-accent-500 px-2 py-1 text-[10px] font-medium text-white"
          >
            Adicionar
          </button>
        ))}
    </div>
  );
}

export function FormatChip({ format }: { format: MockReading["format"] }) {
  return (
    <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
      {FORMAT_LABEL[format]}
    </span>
  );
}

export function ReadingSnippet({
  reading,
  size = "sm",
  clamp = false,
}: {
  reading: MockReading;
  size?: "sm" | "base";
  clamp?: boolean;
}) {
  return (
    <p
      lang="zh-Hans"
      className={`font-hanzi leading-relaxed ${size === "base" ? "text-base" : "text-sm"} ${
        clamp ? "truncate" : ""
      }`}
    >
      <span className="text-slate-500">…{reading.before}</span>
      <mark className="rounded bg-accent-500/20 px-0.5 text-accent-200">{reading.hit}</mark>
      <span className="text-slate-300">{reading.after}…</span>
    </p>
  );
}

/** One generated reading that contains the word. */
export function ReadingRow({
  reading,
  selected = false,
  onSelect,
}: {
  reading: MockReading;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <FormatChip format={reading.format} />
        <span className="truncate">{reading.topic ?? "tema sorteado"}</span>
        {reading.extraWords.length > 0 && (
          <span className="shrink-0 text-amber-400">+{reading.extraWords.length}</span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">
          {new Date(reading.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          })}
        </span>
      </div>
      <div className="mt-1">
        <ReadingSnippet reading={reading} clamp />
      </div>
    </>
  );

  if (!onSelect) return <div className="py-2.5">{body}</div>;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg px-2 py-2.5 text-left transition-colors ${
        selected ? "bg-accent-500/10 ring-1 ring-accent-500/30" : "hover:bg-white/5"
      }`}
    >
      {body}
    </button>
  );
}

export function ReadingDetail({ reading }: { reading: MockReading }) {
  return (
    <div className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        <FormatChip format={reading.format} />
        <span className="truncate">{reading.topic ?? "tema sorteado"}</span>
        <span className="ml-auto font-mono text-slate-600">{reading.model}</span>
      </div>
      <div className="mt-2">
        <ReadingSnippet reading={reading} size="base" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <span>{reading.tokens} tokens</span>
        {reading.extraWords.length > 0 ? (
          <span className="text-amber-400">{reading.extraWords.join(" ")} fora do vocabulário</span>
        ) : (
          <span className="text-emerald-300/80">só vocabulário conhecido</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-accent-300">
          Abrir na Leitura
          <Icon name="arrow-right" className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

/** Small arrow control used by the horizontal strips and compact pagers. */
export function ArrowButton({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label ?? (dir === -1 ? "Anterior" : "Próximo")}
      className="rounded-full border border-white/10 p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 disabled:opacity-25"
    >
      <Icon name={dir === -1 ? "chevron-left" : "chevron-right"} className="h-3.5 w-3.5" />
    </button>
  );
}

/** Mocked stroke viewer — the real one fetches hanzi-writer data over HTTP. */
export function StrokeMock({ sizePx = 150 }: { sizePx?: number }) {
  const [charIdx, setCharIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const active = STROKES[Math.min(charIdx, STROKES.length - 1)];
  const total = active.total;

  return (
    <div className="flex flex-col items-center gap-2">
      {STROKES.length > 1 && (
        <div className="flex gap-1.5">
          {STROKES.map((s, i) => (
            <button
              key={s.character}
              type="button"
              onClick={() => {
                setCharIdx(i);
                setRevealed(0);
              }}
              className={`font-hanzi rounded-md px-2.5 py-0.5 text-base ${
                i === charIdx ? "bg-accent-500 text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              {s.character}
            </button>
          ))}
        </div>
      )}
      <div
        className="relative grid place-items-center rounded-xl bg-slate-800/40 ring-1 ring-white/5"
        style={{ width: sizePx, height: sizePx }}
      >
        <span
          lang="zh-Hans"
          className="font-hanzi text-slate-300/25"
          style={{ fontSize: sizePx * 0.62 }}
        >
          {active.character}
        </span>
        <span
          lang="zh-Hans"
          className="font-hanzi absolute text-accent-500"
          style={{
            fontSize: sizePx * 0.62,
            opacity: total === 0 ? 0 : revealed / Math.max(1, total),
          }}
        >
          {active.character}
        </span>
        <span className="absolute right-1.5 bottom-1 text-[10px] tabular-nums text-slate-600">
          grade 米
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <button
          type="button"
          onClick={() => setRevealed((r) => Math.max(0, r - 1))}
          disabled={revealed === 0}
          aria-label="Traço anterior"
          className="rounded bg-slate-800 p-1 disabled:opacity-30"
        >
          <Icon name="chevron-left" className="h-3 w-3" />
        </button>
        <span className="tabular-nums">
          traço {revealed}/{total}
        </span>
        <button
          type="button"
          onClick={() => setRevealed((r) => Math.min(total, r + 1))}
          disabled={revealed === total}
          aria-label="Próximo traço"
          className="rounded bg-slate-800 p-1 disabled:opacity-30"
        >
          <Icon name="chevron-right" className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function Pager({
  page,
  pages,
  onChange,
  label,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
      <span className="truncate">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Página anterior"
          className="rounded border border-white/10 p-1 text-slate-400 disabled:opacity-30"
        >
          <Icon name="chevron-left" className="h-3 w-3" />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-6 min-w-6 rounded px-1.5 text-[11px] ${
              n === page ? "bg-white/15 text-white" : "text-slate-500 hover:bg-white/5"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(Math.min(pages, page + 1))}
          disabled={page === pages}
          aria-label="Próxima página"
          className="rounded border border-white/10 p-1 text-slate-400 disabled:opacity-30"
        >
          <Icon name="chevron-right" className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function LoadMore({
  shown,
  total,
  onMore,
}: { shown: number; total: number; onMore: () => void }) {
  return (
    <div className="pt-1 text-center">
      <p className="text-[11px] text-slate-500">
        Mostrando {Math.min(shown, total)} de {total}
      </p>
      {shown < total && (
        <button
          type="button"
          onClick={onMore}
          className="mt-1.5 w-full rounded-lg border border-white/10 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
        >
          Carregar mais
        </button>
      )}
    </div>
  );
}
