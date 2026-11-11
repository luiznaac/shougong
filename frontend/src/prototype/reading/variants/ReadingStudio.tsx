// Variant B — "Mesa de leitura" (wayfinder #109). A three-pane workspace:
// history on the left, the article in the middle, and a word inspector plus the
// vocabulary panels on the right. On mobile the panes become segments and the
// inspector is a bottom card.

import { useState } from "react";
import { Icon } from "../../icons.tsx";
import {
  AppChrome,
  ExtraNote,
  GenerateForm,
  LoadMore,
  MetaLine,
  MobileChrome,
  MobileWordSheet,
  Pager,
  ReadingBody,
  TopicsPanel,
  VocabPanel,
  WordDetail,
} from "../parts.tsx";
import { FORMAT_LABELS, HISTORY, type MockToken, READING } from "../readingData.ts";

const PER_PAGE = 8;
const MOBILE_STEP = 5;

function HistoryItem({
  entry,
  active,
}: {
  entry: (typeof HISTORY)[number];
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
        active ? "bg-white/10" : "hover:bg-white/5"
      }`}
    >
      <span lang="zh-Hans" className="font-hanzi block truncate text-[13px] text-slate-200">
        {entry.preview}
      </span>
      <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="font-mono text-slate-600">#{entry.id}</span>
        <span>{FORMAT_LABELS[entry.format]}</span>
        {entry.extra > 0 && <span className="text-amber-400">· {entry.extra} extra(s)</span>}
        <span className="ml-auto">{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</span>
      </span>
    </button>
  );
}

function Desktop() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MockToken | null>(READING.tokens[7] ?? null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const pages = Math.ceil(HISTORY.length / PER_PAGE);
  const rows = HISTORY.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const add = (token: MockToken) => setAdded((prev) => new Set(prev).add(token.entryId ?? -1));

  return (
    <AppChrome>
      <main className="mx-auto grid max-w-7xl gap-4 px-6 py-5 lg:grid-cols-[248px_minmax(0,1fr)_304px]">
        <aside className="flex max-h-[calc(100vh-7rem)] flex-col rounded-2xl bg-slate-900/40 ring-1 ring-white/10">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
            <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Histórico
            </h2>
            <span className="text-[10px] text-slate-500">{HISTORY.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {rows.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} active={entry.id === READING.id} />
            ))}
          </div>
          <div className="border-t border-white/5 px-3 py-2.5">
            <Pager
              page={page}
              pages={pages}
              onChange={setPage}
              label={`${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, HISTORY.length)}`}
            />
          </div>
        </aside>

        <section className="min-w-0">
          <div className="rounded-2xl bg-slate-900/40 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-5 py-3">
              <h1 className="mr-1 text-sm font-semibold text-slate-100">Leitura</h1>
              <GenerateForm layout="bar" compact />
            </div>
            <article className="px-8 py-6">
              <MetaLine reading={READING} />
              <div className="mt-5">
                <ReadingBody
                  tokens={READING.tokens}
                  mode="select"
                  selected={selected}
                  onSelect={setSelected}
                  added={added}
                  onAdd={add}
                />
              </div>
              <div className="mt-5">
                <ExtraNote reading={READING} />
              </div>
            </article>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-2xl bg-slate-900/50 p-4 ring-1 ring-white/10">
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              <Icon name="table" className="h-4 w-4 text-slate-500" />
              Palavra
            </h2>
            <div className="mt-3">
              {selected ? (
                <WordDetail
                  token={selected}
                  added={added.has(selected.entryId ?? -1)}
                  onAdd={() => add(selected)}
                />
              ) : (
                <p className="text-xs text-slate-500">
                  Clique numa palavra do texto para ver pinyin, classe e definição.
                </p>
              )}
            </div>
          </section>
          <VocabPanel compact />
          <TopicsPanel compact />
        </aside>
      </main>
    </AppChrome>
  );
}

function Mobile() {
  const [tab, setTab] = useState<"read" | "history" | "panels">("read");
  const [selected, setSelected] = useState<MockToken | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [shown, setShown] = useState(MOBILE_STEP);
  const add = (token: MockToken) => setAdded((prev) => new Set(prev).add(token.entryId ?? -1));

  return (
    <MobileChrome>
      <div className="border-b border-white/10 px-4 py-2">
        <div className="flex overflow-hidden rounded-lg bg-slate-900/70 p-0.5 text-[11px]">
          {[
            ["read", "Leitura"],
            ["history", "Histórico"],
            ["panels", "Painéis"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as typeof tab)}
              className={`flex-1 rounded-md py-1.5 font-medium ${
                tab === key ? "bg-white/10 text-white" : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "read" && (
        <div className="p-4">
          <article className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
            <MetaLine reading={READING} />
            <div className="mt-4">
              <ReadingBody
                tokens={READING.tokens}
                mode="select"
                selected={selected}
                onSelect={setSelected}
                added={added}
                onAdd={add}
              />
            </div>
            <div className="mt-4">
              <ExtraNote reading={READING} />
            </div>
          </article>
          <div className="mt-3 rounded-xl bg-slate-900/50 p-3 ring-1 ring-white/10">
            <h2 className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Palavra selecionada
            </h2>
            <div className="mt-2">
              {selected ? (
                <WordDetail
                  token={selected}
                  added={added.has(selected.entryId ?? -1)}
                  onAdd={() => add(selected)}
                />
              ) : (
                <p className="text-[11px] text-slate-500">Toque numa palavra para inspecionar.</p>
              )}
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-slate-900/50 p-3 ring-1 ring-white/10">
            <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Nova leitura
            </h2>
            <GenerateForm layout="stack" compact />
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="p-4">
          <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Histórico
          </h2>
          <div className="mt-2 divide-y divide-white/5">
            {HISTORY.slice(0, shown).map((entry) => (
              <div key={entry.id} className="py-2">
                <span lang="zh-Hans" className="font-hanzi block truncate text-sm text-slate-200">
                  {entry.preview}
                </span>
                <span className="text-[10px] text-slate-500">
                  #{entry.id} · {FORMAT_LABELS[entry.format]} · {entry.topic ?? "tema sorteado"}
                </span>
              </div>
            ))}
          </div>
          <LoadMore
            shown={shown}
            total={HISTORY.length}
            onMore={() => setShown(shown + MOBILE_STEP)}
          />
        </div>
      )}

      {tab === "panels" && (
        <div className="space-y-3 p-4">
          <VocabPanel compact />
          <TopicsPanel compact />
        </div>
      )}

      <MobileWordSheet
        token={tab === "read" ? null : selected}
        added={added}
        onAdd={add}
        onClose={() => setSelected(null)}
      />
    </MobileChrome>
  );
}

export function ReadingStudio() {
  return (
    <>
      <Desktop />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <div className="h-[720px] w-[390px] overflow-hidden rounded-[2.4rem] border-[10px] border-slate-800 bg-slate-950 shadow-2xl">
            <Mobile />
          </div>
        </div>
      </div>
    </>
  );
}
