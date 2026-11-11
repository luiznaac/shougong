// Variant C — "Estante" (wayfinder #109). Library-first: the history of readings
// is the page (a paged card grid), generating is a side panel, and opening a
// card swaps into a full reader with a word popover. On mobile the list is home
// and the reader is full-screen with a bottom word card.

import { useState } from "react";
import { Icon } from "../../icons.tsx";
import {
  AppChrome,
  AttemptTrail,
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
} from "../parts.tsx";
import { FORMAT_LABELS, HISTORY, type MockToken, READING } from "../readingData.ts";

const PER_PAGE = 6;
const MOBILE_STEP = 4;

function ReadingCard({
  entry,
  onOpen,
}: {
  entry: (typeof HISTORY)[number];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col rounded-2xl bg-slate-900/40 p-4 text-left ring-1 ring-white/10 transition-colors hover:bg-slate-900/70 hover:ring-white/20"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-400">
          {FORMAT_LABELS[entry.format]}
        </span>
        <span className="truncate">{entry.topic ?? "tema sorteado"}</span>
        <span className="ml-auto font-mono text-slate-600">#{entry.id}</span>
      </div>
      <p
        lang="zh-Hans"
        className="font-hanzi mt-2 line-clamp-2 min-h-12 text-lg leading-relaxed text-slate-200"
      >
        {entry.preview}
      </p>
      <div className="mt-auto flex items-center gap-2 pt-3 text-[10px] text-slate-500">
        {entry.extra > 0 && <span className="text-amber-400">{entry.extra} extra(s)</span>}
        <span>{entry.tokens} tokens</span>
        <span className="ml-auto">{new Date(entry.createdAt).toLocaleDateString("pt-BR")}</span>
      </div>
    </button>
  );
}

function Reader({ onBack }: { onBack: () => void }) {
  const [added, setAdded] = useState<Set<number>>(new Set());
  const add = (token: MockToken) => setAdded((prev) => new Set(prev).add(token.entryId ?? -1));
  return (
    <main className="mx-auto max-w-3xl px-6 py-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
      >
        <Icon name="chevron-left" className="h-3.5 w-3.5" />
        Estante
      </button>
      <article className="mt-3 rounded-2xl bg-slate-900/40 px-8 py-7 ring-1 ring-white/10">
        <MetaLine reading={READING} />
        <div className="mt-5">
          <ReadingBody tokens={READING.tokens} added={added} onAdd={add} />
        </div>
        <div className="mt-5 space-y-3">
          <ExtraNote reading={READING} />
          <AttemptTrail reading={READING} />
        </div>
      </article>
    </main>
  );
}

function Desktop() {
  const [view, setView] = useState<"shelf" | "reader">("shelf");
  const [page, setPage] = useState(1);
  const pages = Math.ceil(HISTORY.length / PER_PAGE);
  const rows = HISTORY.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <AppChrome>
      {view === "reader" ? (
        <Reader onBack={() => setView("shelf")} />
      ) : (
        <main className="mx-auto max-w-6xl px-6 py-8">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Leitura</h1>
            <p className="mt-1 text-sm text-slate-400">
              Sua estante de textos gerados. Abra uma leitura para consultar palavras, ou gere uma
              nova ao lado.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              <div className="grid gap-3 sm:grid-cols-2">
                {rows.map((entry) => (
                  <ReadingCard key={entry.id} entry={entry} onOpen={() => setView("reader")} />
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-slate-900/40 px-4 py-3 ring-1 ring-white/10">
                <Pager
                  page={page}
                  pages={pages}
                  onChange={setPage}
                  label={`${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, HISTORY.length)} de ${HISTORY.length} leituras`}
                />
              </div>
            </section>

            <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
              <section className="rounded-2xl bg-slate-900/50 p-4 ring-1 ring-white/10">
                <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  <Icon name="plus" className="h-4 w-4 text-accent-500" />
                  Nova leitura
                </h2>
                <GenerateForm layout="panel" />
              </section>
              <VocabPanel compact />
              <TopicsPanel compact />
            </aside>
          </div>
        </main>
      )}
    </AppChrome>
  );
}

function Mobile() {
  const [view, setView] = useState<"shelf" | "reader">("shelf");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shown, setShown] = useState(MOBILE_STEP);
  const [selected, setSelected] = useState<MockToken | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const add = (token: MockToken) => setAdded((prev) => new Set(prev).add(token.entryId ?? -1));

  return (
    <MobileChrome>
      {view === "reader" ? (
        <div className="p-4">
          <button
            type="button"
            onClick={() => setView("shelf")}
            className="flex items-center gap-1 text-[11px] text-slate-400"
          >
            <Icon name="chevron-left" className="h-3.5 w-3.5" />
            Estante
          </button>
          <article className="mt-2 rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
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
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Leitura</h1>
              <p className="text-[11px] text-slate-500">{HISTORY.length} textos na estante</p>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-medium text-white"
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              Nova
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {HISTORY.slice(0, shown).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setView("reader")}
                className="flex w-full flex-col rounded-xl bg-slate-900/40 p-3 text-left ring-1 ring-white/10"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-400">
                    {FORMAT_LABELS[entry.format]}
                  </span>
                  <span className="truncate">{entry.topic ?? "tema sorteado"}</span>
                  {entry.extra > 0 && (
                    <span className="ml-auto text-amber-400">+{entry.extra}</span>
                  )}
                </div>
                <p
                  lang="zh-Hans"
                  className="font-hanzi mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-200"
                >
                  {entry.preview}
                </p>
              </button>
            ))}
          </div>
          <LoadMore
            shown={shown}
            total={HISTORY.length}
            onMore={() => setShown(shown + MOBILE_STEP)}
          />
        </div>
      )}

      {sheetOpen && (
        <div className="sticky bottom-0 z-20 border-t border-white/10 bg-slate-900/95 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Nova leitura
            </h2>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Fechar"
              className="rounded p-1 text-slate-500 hover:bg-white/10"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3">
            <GenerateForm layout="stack" compact />
          </div>
          <div className="mt-3 space-y-2">
            <VocabPanel compact />
            <TopicsPanel compact />
          </div>
        </div>
      )}

      <MobileWordSheet
        token={selected}
        added={added}
        onAdd={add}
        onClose={() => setSelected(null)}
      />
    </MobileChrome>
  );
}

export function ReadingShelf() {
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
