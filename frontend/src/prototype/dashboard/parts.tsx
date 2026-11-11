// Throwaway prototype parts (wayfinder ticket #107 — Dashboard). Shared pieces:
// the app shell decided in #105 (top bar + mobile tabs), the character tile, the
// two custom badge icons and a sparkline. Dashboard *layout* is never shared —
// each variant owns its own structure.

import type { ReactNode } from "react";
import { Hanzi } from "../../components/Hanzi.tsx";
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

export function Badge({ kind, small = false }: { kind: "ghost" | "bolt"; small?: boolean }) {
  const leech = kind === "ghost";
  return (
    <span
      role="img"
      aria-label={leech ? "Sanguessuga" : "Prioridade"}
      title={leech ? "Sanguessuga" : "Prioridade"}
      className={`grid place-items-center rounded-full bg-slate-950/85 ring-1 ring-white/10 ${
        small ? "h-3 w-3" : "h-4 w-4"
      } ${leech ? "text-rose-300" : "text-amber-300"}`}
    >
      <Icon name={kind} className={small ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={2.6} />
    </span>
  );
}

/** Character tile — the shared visual primitive; layouts arrange it. */
export function CharTile({
  item,
  compact = false,
  fluid = false,
}: {
  item: MockItem;
  compact?: boolean;
  /** Fill the grid cell instead of a fixed width (prevents phone-grid overlap). */
  fluid?: boolean;
}) {
  return (
    <div
      className={`relative grid place-items-center rounded-lg border-b-2 bg-slate-900/70 ring-1 ring-white/5 ${
        fluid ? "h-[52px] w-full min-w-0" : compact ? "h-11 w-11" : "h-[54px] w-[54px]"
      }`}
      style={{ borderColor: GROUP_COLOR[item.group] }}
      title={`${item.hanzi} · ${item.group} · ${item.due}`}
    >
      <span className="absolute top-0.5 right-0.5 flex gap-0.5">
        {item.leech ? <Badge kind="ghost" small /> : null}
        {item.pinned ? <Badge kind="bolt" small /> : null}
      </span>
      <Hanzi
        text={item.hanzi}
        singleCharPx={compact ? 18 : 22}
        boxPx={compact ? 36 : 46}
        className="text-slate-50"
      />
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
