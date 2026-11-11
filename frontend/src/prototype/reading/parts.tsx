// Throwaway prototype parts (wayfinder ticket #109 — Reading). Shared pieces:
// the app shell adopted in #105 (top bar + mobile tabs), the word detail card,
// the vocabulary/topic panels and the paging primitives. Layout is never shared
// — each variant owns its own structure.

import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import type { ReactNode } from "react";
import { Pinyin } from "../../components/Pinyin.tsx";
import { Icon } from "../icons.tsx";
import {
  ACTIVE_TOPICS,
  FORMAT_LABELS,
  MODELS,
  type MockFormat,
  type MockReading,
  type MockToken,
  VOCAB,
} from "./readingData.ts";

const NAV = ["Hoje", "Biblioteca", "Leitura", "Progresso"];

/** Desktop app shell adopted from #105, with Leitura active. */
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
                  label === "Leitura"
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

/** Mobile app shell adopted from #105 (top bar + bottom tabs, Leitura active). */
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
          ["Biblioteca", "book", false],
          ["Leitura", "text", true],
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

export function MetaLine({
  reading,
  className = "",
}: { reading: MockReading; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 ${className}`}
    >
      <span>#{reading.id}</span>
      <span>·</span>
      <span>{FORMAT_LABELS[reading.format]}</span>
      <span>·</span>
      <span className="truncate font-mono">{reading.model}</span>
      {reading.topic && (
        <>
          <span>·</span>
          <span className={reading.topicGenerated ? "italic" : ""}>
            {reading.topic}
            {reading.topicGenerated && " (sorteado)"}
          </span>
        </>
      )}
      {reading.attempts > 1 && (
        <>
          <span>·</span>
          <span>{reading.attempts} tentativas</span>
        </>
      )}
      <span>·</span>
      <span>{reading.tokens.filter((t) => t.isWord).length} palavras</span>
      <span className="ml-auto">{new Date(reading.createdAt).toLocaleString("pt-BR")}</span>
    </div>
  );
}

/** One word's detail card — shared by the desktop popover, the mobile sheet and B's inspector. */
export function WordDetail({
  token,
  added,
  onAdd,
  onClose,
}: {
  token: MockToken;
  added: boolean;
  onAdd: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p lang="zh-Hans" className="font-hanzi text-xl text-slate-100">
            {token.text}
          </p>
          {token.pinyin && <Pinyin value={token.pinyin} className="text-sm" />}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-slate-200"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        )}
      </div>
      {token.pos && (
        <p className="mt-1.5 text-[10px] tracking-wide text-slate-500 uppercase">{token.pos}</p>
      )}
      {token.definitions && token.definitions.length > 0 && (
        <p className="mt-1 text-slate-300">{token.definitions.join("; ")}</p>
      )}
      {token.extra && <p className="mt-1 text-xs text-amber-400">Fora do vocabulário conhecido</p>}
      <button
        type="button"
        onClick={onAdd}
        className={`mt-2.5 w-full rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
          added
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
            : "bg-accent-500 text-white hover:bg-accent-600"
        }`}
      >
        {added ? "Na fila de estudo" : "Adicionar ao estudo"}
      </button>
    </div>
  );
}

function WordButton({
  token,
  selected,
  onSelect,
}: {
  token: MockToken;
  selected: boolean;
  onSelect: (token: MockToken) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className={`rounded px-0.5 transition-colors ${
        token.extra
          ? "text-amber-400 underline decoration-dotted underline-offset-4"
          : "text-slate-100"
      } ${selected ? "bg-accent-500/25 ring-1 ring-accent-500/40" : "hover:bg-white/10"}`}
    >
      {token.text}
    </button>
  );
}

/**
 * The reading body. `mode` picks the interaction: an anchored popover (A/C),
 * an external inspector (B), or just static text (preview rows).
 */
export function ReadingBody({
  tokens,
  size = "lg",
  mode = "popover",
  selected,
  onSelect,
  added,
  onAdd,
}: {
  tokens: MockToken[];
  size?: "lg" | "md" | "sm";
  mode?: "popover" | "select" | "plain";
  selected?: MockToken | null;
  onSelect?: (token: MockToken | null) => void;
  added: Set<number>;
  onAdd: (token: MockToken) => void;
}) {
  const textSize =
    size === "lg" ? "text-2xl sm:text-[26px]" : size === "md" ? "text-xl" : "text-base";

  return (
    <p
      lang="zh-Hans"
      className={`font-hanzi leading-[2.15] tracking-wide text-slate-100 ${textSize}`}
    >
      {tokens.map((token, i) => {
        if (!token.isWord) return <span key={`${token.text}-${i}`}>{token.text}</span>;
        const isSelected = selected?.text === token.text && selected?.pinyin === token.pinyin;

        if (mode === "plain") return <span key={`${token.text}-${i}`}>{token.text}</span>;

        if (mode === "select") {
          return (
            <WordButton
              key={`${token.text}-${i}`}
              token={token}
              selected={isSelected}
              onSelect={(t) => onSelect?.(t)}
            />
          );
        }

        return (
          <Popover.Root key={`${token.text}-${i}`}>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={`rounded px-0.5 transition-colors hover:bg-white/10 ${
                  token.extra
                    ? "text-amber-400 underline decoration-dotted underline-offset-4"
                    : "text-slate-100"
                }`}
              >
                {token.text}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                sideOffset={8}
                className="z-50 w-64 rounded-xl border border-white/10 bg-slate-800 p-3 shadow-2xl"
              >
                <WordDetail
                  token={token}
                  added={added.has(token.entryId ?? -1)}
                  onAdd={() => onAdd(token)}
                />
                <Popover.Arrow className="fill-slate-800" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        );
      })}
    </p>
  );
}

/** Mobile bottom card for the selected word — sticky at the bottom of the phone scroll area. */
export function MobileWordSheet({
  token,
  added,
  onAdd,
  onClose,
}: {
  token: MockToken | null;
  added: Set<number>;
  onAdd: (token: MockToken) => void;
  onClose: () => void;
}) {
  if (!token) return null;
  return (
    <div className="sticky bottom-0 z-20 border-t border-white/10 bg-slate-900/95 p-4 shadow-[0_-18px_30px_rgba(0,0,0,0.45)] backdrop-blur">
      <WordDetail
        token={token}
        added={added.has(token.entryId ?? -1)}
        onAdd={() => onAdd(token)}
        onClose={onClose}
      />
    </div>
  );
}

export function VocabPanel({ compact = false }: { compact?: boolean }) {
  return (
    <details open={!compact} className="group rounded-xl bg-slate-900/50 ring-1 ring-white/10">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        <Icon name="chart" className="h-4 w-4 text-slate-500" />
        Meu vocabulário
        <span className="ml-auto font-normal normal-case text-slate-500">
          {VOCAB.categorised}/{VOCAB.total} no HSK
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          {VOCAB.byCategory.map(([label, n]) => (
            <span key={label}>
              {label}: <span className="text-slate-200">{n}</span>
            </span>
          ))}
        </div>
        <div className="space-y-1.5">
          {VOCAB.byLevel.map(([label, n, pct]) => (
            <div key={label} className="flex items-center gap-2 text-[11px]">
              <span className="w-12 shrink-0 text-slate-500">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-accent-500/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-slate-400">
                {n} · {pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function TopicsPanel({ compact = false }: { compact?: boolean }) {
  const [draft, setDraft] = useState("");
  const active = ACTIVE_TOPICS.filter((t) => t.active).length;
  return (
    <details open={!compact} className="rounded-xl bg-slate-900/50 ring-1 ring-white/10">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        <Icon name="spark" className="h-4 w-4 text-slate-500" />
        Temas sorteáveis
        <span className="ml-auto font-normal normal-case text-slate-500">
          {active} ativo(s) de {ACTIVE_TOPICS.length}
        </span>
      </summary>
      <div className="space-y-2 px-4 pb-4">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="novo cenário, em inglês"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
          />
          <button
            type="button"
            disabled={!draft.trim()}
            className="rounded-md bg-accent-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Adicionar
          </button>
        </div>
        <ul className="max-h-44 space-y-1 overflow-y-auto pr-1 text-xs">
          {ACTIVE_TOPICS.map((topic) => (
            <li key={topic.id} className="flex items-center gap-2 text-slate-300">
              <span
                className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded border ${
                  topic.active
                    ? "border-accent-500 bg-accent-500/20 text-accent-500"
                    : "border-white/15 text-transparent"
                }`}
              >
                {topic.active && <Icon name="check" className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
              <span className={topic.active ? "" : "text-slate-500 line-through"}>
                {topic.scenario}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function FormatPicker({ value }: { value: MockFormat }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-white/10 bg-slate-950/60 p-0.5 text-[11px]">
      {(Object.keys(FORMAT_LABELS) as MockFormat[]).map((f) => (
        <span
          key={f}
          className={`rounded-md px-2 py-1 ${
            f === value ? "bg-white/10 text-white" : "text-slate-500"
          }`}
        >
          {FORMAT_LABELS[f]}
        </span>
      ))}
    </div>
  );
}

export function ModelPicker({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-300">
      <Icon name="spark" className="h-3.5 w-3.5 text-accent-500" />
      <span className="font-mono">{value}</span>
      <Icon name="chevron-right" className="h-3 w-3 rotate-90 text-slate-500" />
    </span>
  );
}

export function GenerateForm({
  layout,
  compact = false,
}: {
  layout: "bar" | "stack" | "panel";
  compact?: boolean;
}) {
  const wrapper =
    layout === "bar"
      ? "flex flex-wrap items-center gap-2"
      : layout === "panel"
        ? "space-y-3"
        : "space-y-3";
  return (
    <div className={wrapper}>
      <FormatPicker value="paragraph" />
      <ModelPicker value={MODELS[0]} />
      <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-400">
        <Icon name="plus" className="h-3.5 w-3.5" />
        extras
        <span className="rounded bg-white/10 px-1 text-slate-300">2</span>
      </span>
      <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-400">
        <Icon name="clock" className="h-3.5 w-3.5" />
        tentativas
        <span className="rounded bg-white/10 px-1 text-slate-300">3</span>
      </span>
      <div
        className={`flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 ${
          layout === "bar" ? "min-w-44 flex-1" : ""
        }`}
      >
        <Icon name="text" className="h-3.5 w-3.5 text-slate-500" />
        <span className="truncate text-[11px] text-slate-500">Tópico (vazio = tema sorteado)</span>
      </div>
      <button
        type="button"
        className={`rounded-lg bg-accent-500 font-medium text-white transition-colors hover:bg-accent-600 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        Gerar leitura
      </button>
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
      <span>{label}</span>
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
    <div className="pt-2 text-center">
      <p className="text-[11px] text-slate-500">
        Mostrando {Math.min(shown, total)} de {total}
      </p>
      {shown < total && (
        <button
          type="button"
          onClick={onMore}
          className="mt-2 w-full rounded-lg border border-white/10 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
        >
          Carregar mais
        </button>
      )}
    </div>
  );
}

export function ExtraNote({ reading }: { reading: MockReading }) {
  if (reading.extraWords.length === 0) return null;
  return (
    <p className="text-xs text-amber-400">
      {reading.extraWords.join(" ")} — {reading.extraWords.length} palavra(s) fora do vocabulário
      conhecido.
    </p>
  );
}

export function AttemptTrail({ reading }: { reading: MockReading }) {
  return (
    <details className="rounded-xl bg-slate-900/40 ring-1 ring-white/10">
      <summary className="cursor-pointer px-4 py-2.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
        Iterações ({reading.attempts})
      </summary>
      <div className="space-y-2 px-4 pb-4 text-[11px] text-slate-400">
        <p>
          <span className="text-amber-400">1</span> · 2 palavras fora do vocabulário: 饭馆 然后 ·
          descartada
        </p>
        <p>
          <span className="text-emerald-300">2</span> · 0 palavras fora · escolhida · 1.284 tokens
        </p>
      </div>
    </details>
  );
}
