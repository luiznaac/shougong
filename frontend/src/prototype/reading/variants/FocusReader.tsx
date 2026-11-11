// Variant A — "Leitura em foco" (wayfinder #109). Reader-first: the article is
// the page, the generator is a compact command bar, history and the vocabulary
// panels live below it (desktop) or behind a sheet + load-more (mobile).

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

function HistoryRow({
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
      className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
    >
      <span className="w-10 shrink-0 pt-0.5 font-mono text-[10px] text-slate-600">#{entry.id}</span>
      <span className="min-w-0 flex-1">
        <span lang="zh-Hans" className="font-hanzi block truncate text-sm text-slate-200">
          {entry.preview}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-slate-500">
          <span>{FORMAT_LABELS[entry.format]}</span>
          <span>·</span>
          <span className="truncate">{entry.topic ?? "tema sorteado"}</span>
          {entry.extra > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-400">{entry.extra} extra(s)</span>
            </>
          )}
        </span>
      </span>
      <span className="shrink-0 text-[10px] text-slate-600">
        {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
      </span>
    </button>
  );
}

function Desktop() {
  const [page, setPage] = useState(1);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const pages = Math.ceil(HISTORY.length / PER_PAGE);
  const rows = HISTORY.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const add = (token: MockToken) => setAdded((prev) => new Set(prev).add(token.entryId ?? -1));

  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Leitura</h1>
            <p className="mt-1 text-sm text-slate-400">
              Textos em mandarim restritos ao seu vocabulário. Clique numa palavra para ver pinyin,
              classe e definição.
            </p>
          </div>
          <GenerateForm layout="bar" compact />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
          <div className="min-w-0 space-y-4">
            <article className="rounded-2xl bg-slate-900/40 px-8 py-7 ring-1 ring-white/10">
              <MetaLine reading={READING} />
              <div className="mt-5">
                <ReadingBody tokens={READING.tokens} added={added} onAdd={add} />
              </div>
              <div className="mt-5 space-y-3">
                <ExtraNote reading={READING} />
                <AttemptTrail reading={READING} />
              </div>
            </article>

            <section className="rounded-2xl bg-slate-900/40 ring-1 ring-white/10">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Histórico
                </h2>
                <span className="text-[11px] text-slate-500">{HISTORY.length} leituras</span>
              </div>
              <div className="divide-y divide-white/5">
                {rows.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} onOpen={() => {}} />
                ))}
              </div>
              <div className="border-t border-white/5 px-4 py-3">
                <Pager
                  page={page}
                  pages={pages}
                  onChange={setPage}
                  label={`${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, HISTORY.length)} de ${HISTORY.length}`}
                />
              </div>
            </section>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <VocabPanel />
            <TopicsPanel />
          </aside>
        </div>
      </main>
    </AppChrome>
  );
}

function Mobile() {
  const [formOpen, setFormOpen] = useState(false);
  const [shown, setShown] = useState(MOBILE_STEP);
  const [selected, setSelected] = useState<MockToken | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());

  const add = (token: MockToken) => setAdded((prev) => new Set(prev).add(token.entryId ?? -1));

  return (
    <MobileChrome>
      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">Leitura</h1>
            <p className="text-[11px] text-slate-500">Toque numa palavra para ver o significado.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-medium text-white"
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            Nova
          </button>
        </div>

        {formOpen && (
          <div className="mt-3 rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/10">
            <GenerateForm layout="stack" compact />
          </div>
        )}

        <article className="mt-4 rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
          <MetaLine reading={READING} />
          <div className="mt-4">
            <ReadingBody
              tokens={READING.tokens}
              size="lg"
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

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Histórico
            </h2>
            <span className="text-[10px] text-slate-500">{HISTORY.length}</span>
          </div>
          <div className="mt-2 divide-y divide-white/5">
            {HISTORY.slice(0, shown).map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 py-2.5">
                <span className="min-w-0 flex-1">
                  <span lang="zh-Hans" className="font-hanzi block truncate text-sm text-slate-200">
                    {entry.preview}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {FORMAT_LABELS[entry.format]} · {entry.topic ?? "tema sorteado"}
                  </span>
                </span>
                <span className="text-[10px] text-slate-600">
                  {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
          <LoadMore
            shown={shown}
            total={HISTORY.length}
            onMore={() => setShown(shown + MOBILE_STEP)}
          />
        </section>

        <div className="mt-6 space-y-2">
          <VocabPanel compact />
          <TopicsPanel compact />
        </div>
      </div>
      <MobileWordSheet
        token={selected}
        added={added}
        onAdd={add}
        onClose={() => setSelected(null)}
      />
    </MobileChrome>
  );
}

export function FocusReader() {
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
