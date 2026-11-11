// Throwaway prototype parts (wayfinder ticket #108 — Add items and Batch import).
// Shared only where every variant genuinely agrees: the app shell adopted in
// #105, the pager primitives and the status vocabulary. Layout is never shared —
// each variant owns its own structure.

import type { ReactNode } from "react";
import type { BatchImportOutcome } from "../../api/types.ts";
import { Hanzi } from "../../components/Hanzi.tsx";
import { Pinyin } from "../../components/Pinyin.tsx";
import { Icon } from "../icons.tsx";

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
      <div className="flex-1 overflow-y-auto">{children}</div>
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

export function Card({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-slate-900/50 ring-1 ring-white/10 ${className}`}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3.5">
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {title}
            </h2>
            {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function SearchField({
  value,
  placeholder = "你好, ni3hao3, hello…",
  compact = false,
}: {
  value: string;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 ${
        compact ? "py-2" : "py-3"
      }`}
    >
      <Icon name="search" className={compact ? "h-4 w-4" : "h-5 w-5"} />
      <span
        className={`min-w-0 flex-1 truncate ${compact ? "text-sm" : "text-base"} ${
          value ? "text-slate-100" : "text-slate-500"
        }`}
      >
        {value || placeholder}
      </span>
      {value && <Icon name="close" className="h-4 w-4 text-slate-500" />}
    </div>
  );
}

export function HsxChip({ level }: { level: number | null }) {
  if (level === null) return null;
  return (
    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-500/20">
      HSK {level}
    </span>
  );
}

type StatusKey = BatchImportOutcome["status"] | "pending" | "loading";

const STATUS_STYLE: Record<StatusKey, { label: string; className: string }> = {
  pending: { label: "na fila", className: "bg-slate-500/10 text-slate-400 ring-slate-500/20" },
  loading: { label: "enviando", className: "bg-sky-500/15 text-sky-300 ring-sky-500/20" },
  created: { label: "criada", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20" },
  skipped: { label: "pulada", className: "bg-slate-500/15 text-slate-400 ring-slate-500/20" },
  error: { label: "erro", className: "bg-rose-500/15 text-rose-300 ring-rose-500/20" },
};

export function StatusPill({ status }: { status: StatusKey }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${style.className}`}
    >
      {status === "loading" && (
        <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
      )}
      {style.label}
    </span>
  );
}

export function EnqueueButton({
  enqueued,
  addedNow = false,
}: {
  enqueued: boolean;
  addedNow?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
        addedNow
          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
          : enqueued
            ? "bg-slate-800 text-slate-500"
            : "bg-accent-500 text-white"
      }`}
    >
      {addedNow ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
      {addedNow ? "Adicionado" : enqueued ? "Na fila" : "Adicionar"}
    </span>
  );
}

export function EntryIdentity({
  simplified,
  pinyin,
  definitions,
  size = "md",
}: {
  simplified: string;
  pinyin: string;
  definitions: string[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Hanzi
        text={simplified}
        singleCharPx={size === "sm" ? 20 : 26}
        boxPx={size === "sm" ? 64 : 84}
        className="shrink-0 text-slate-100"
      />
      <div className="min-w-0">
        <Pinyin value={pinyin} className={size === "sm" ? "text-[11px]" : "text-xs"} />
        <p className="truncate text-sm text-slate-300">{definitions.join("; ")}</p>
      </div>
    </div>
  );
}

/** Explicit page controls — desktop tables/grids (map convention). */
export function Pager({
  page,
  pageSize,
  total,
  pages = 3,
}: {
  page: number;
  pageSize: number;
  total: number;
  pages?: number;
}) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const window = Array.from({ length: pages }, (_, i) => page + i).filter(
    (p) => p * pageSize <= total + pageSize,
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto text-xs text-slate-500 tabular-nums">
        {first}–{last} de {total.toLocaleString("pt-BR")}
      </span>
      <span className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400">
        <Icon name="chevron-left" className="h-3.5 w-3.5" />
      </span>
      {window.map((p) => (
        <span
          key={p}
          className={`grid h-7 min-w-7 place-items-center rounded-md px-2 text-xs tabular-nums ${
            p === page
              ? "bg-accent-500 font-semibold text-white"
              : "border border-white/10 text-slate-400"
          }`}
        >
          {p}
        </span>
      ))}
      <span className="text-xs text-slate-600">…</span>
      <span className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400">
        <Icon name="chevron-right" className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

/** "Load more" — mobile lists (map convention; never infinite scroll). */
export function LoadMore({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-center gap-1 rounded-lg border border-white/10 py-2 text-xs font-medium text-slate-300">
        <Icon name="plus" className="h-3.5 w-3.5" />
        Carregar mais
      </div>
      <p className="text-center text-[10px] text-slate-500 tabular-nums">
        Mostrando {shown} de {total.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

export function SummaryTiles({
  created,
  skipped,
  errors,
}: {
  created: number;
  skipped: number;
  errors: number;
}) {
  const tiles = [
    { label: "criadas", value: created, tone: "text-emerald-300" },
    { label: "puladas", value: skipped, tone: "text-slate-300" },
    { label: "com erro", value: errors, tone: "text-rose-300" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg bg-slate-950/50 px-3 py-2 ring-1 ring-white/5">
          <div className={`text-lg font-semibold tabular-nums ${t.tone}`}>{t.value}</div>
          <div className="text-[10px] tracking-wide text-slate-500 uppercase">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

export function CandidatePicker({
  candidates,
  compact = false,
}: {
  candidates: BatchImportOutcome["candidates"];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-1.5 space-y-1" : "space-y-1"}>
      <p className="text-[11px] text-slate-500">
        {candidates.length > 1 ? "Escolha qual usar:" : "Adicionar assim mesmo?"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-slate-800 px-2 py-1 text-[11px] text-slate-200"
          >
            <span className="font-hanzi" lang="zh-Hans">
              {c.simplified}
            </span>
            <span className="text-slate-400">{c.pinyin}</span>
            <span className="max-w-40 truncate text-slate-500">
              {c.definitions.slice(0, 2).join("; ") || "sem definição"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
