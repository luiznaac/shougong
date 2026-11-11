// Throwaway prototype parts (wayfinder ticket #107 — Dashboard). Shared pieces:
// the app shell decided in #105 (top bar + mobile tabs), the character tile, the
// two custom badge icons and a sparkline. Dashboard *layout* is never shared —
// each variant owns its own structure.

import type { ReactNode } from "react";
import { Hanzi } from "../../components/Hanzi.tsx";
import { Pinyin } from "../../components/Pinyin.tsx";
import { GROUP_COLOR } from "../../lib/srs.ts";
import { Icon } from "../icons.tsx";
import type { MockItem } from "./dashboardData.ts";

const NAV = ["Hoje", "Biblioteca", "Leitura", "Progresso"];

/** Desktop app shell adopted from the #105 prototype (Command bar). */
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
            {NAV.map((label, i) => (
              <span
                key={label}
                className={`cursor-default rounded-md px-3 py-1.5 text-sm font-medium ${
                  i === 0 ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
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

/** Mobile app shell adopted from the #105 prototype (top bar + bottom tabs). */
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
      <div className="flex-1 overflow-y-auto">{children}</div>
      <nav className="flex shrink-0 border-t border-white/10 bg-slate-950 px-2 pb-2 pt-1">
        {[
          ["Hoje", "home", true],
          ["Biblioteca", "book", false],
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

export function Badge({ kind }: { kind: "ghost" | "bolt" }) {
  const leech = kind === "ghost";
  return (
    <span
      role="img"
      aria-label={leech ? "Sanguessuga" : "Prioridade"}
      title={leech ? "Sanguessuga" : "Prioridade"}
      className={`grid h-4 w-4 place-items-center rounded-full bg-slate-950/85 ring-1 ring-white/10 ${
        leech ? "text-rose-300" : "text-amber-300"
      }`}
    >
      <Icon name={kind} className="h-3 w-3" strokeWidth={2.6} />
    </span>
  );
}

/** Character tile — the shared visual primitive; layouts arrange it. */
export function CharTile({ item, compact = false }: { item: MockItem; compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border-b-2 bg-slate-900/70 text-center ring-1 ring-white/5 ${
        compact ? "w-20 px-1 py-1.5" : "w-24 px-1.5 py-2"
      }`}
      style={{ borderColor: GROUP_COLOR[item.group] }}
      title={`${item.group} · ${item.due}`}
    >
      <div className="flex h-4 items-center gap-0.5 self-end">
        {item.leech ? <Badge kind="ghost" /> : null}
        {item.pinned ? <Badge kind="bolt" /> : null}
      </div>
      <Pinyin
        value={item.pinyin}
        className={`max-w-full truncate leading-tight ${compact ? "text-[9px]" : "text-[10px]"}`}
      />
      <Hanzi
        text={item.hanzi}
        singleCharPx={compact ? 24 : 28}
        boxPx={compact ? 72 : 88}
        className="my-1 text-slate-50"
      />
      {compact ? null : (
        <span className="line-clamp-1 max-w-full text-[10px] text-slate-400">{item.meaning}</span>
      )}
    </div>
  );
}

/** Tiny cumulative sparkline from a plain series. */
export function Sparkline({
  series,
  className = "h-24 w-full",
}: {
  series: number[];
  className?: string;
}) {
  const max = Math.max(1, ...series);
  const points = series
    .map((y, i) => `${(i / Math.max(1, series.length - 1)) * 100},${100 - (y / max) * 100}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className}>
      <title>Itens aprendidos ao longo do tempo</title>
      <polygon
        points={`0,100 ${points} 100,100`}
        fill="var(--color-accent-500)"
        fillOpacity="0.15"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent-500)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Neutral section card shared by the two card-style variants. */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-slate-900/50 p-5 ring-1 ring-white/10 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

/** Stable keys for loading skeletons (bare index keys are lint-flagged). */
export const PLACEHOLDER_KEYS = [
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
  "p7",
  "p8",
  "p9",
  "p10",
  "p11",
  "p12",
];
