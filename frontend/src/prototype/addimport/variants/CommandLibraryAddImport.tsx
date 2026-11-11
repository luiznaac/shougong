// PROTOTYPE (wayfinder ticket #108) — Variant C "Biblioteca com busca".
// Search is the primary surface and reads as the library itself: a command bar
// over dense results, with import as a side drawer/bottom sheet and batch
// activity as a feed. Fewer pages, one destination.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import {
  BATCH_FILE,
  BATCH_OUTCOMES,
  BATCH_TEXT,
  COUNTS,
  DICTIONARY,
  QUEUE_IDS,
} from "../addImportData.ts";
import {
  AppChrome,
  CandidatePicker,
  Card,
  EnqueueButton,
  EntryIdentity,
  HsxChip,
  LoadMore,
  MobileChrome,
  Pager,
  StatusPill,
  SummaryTiles,
} from "../parts.tsx";

const FILTERS = ["Todos", "HSK 1", "HSK 2", "Na fila"];
const FEED_FILTERS = ["Tudo", "Criadas", "Puladas", "Erros"];

function SearchCommandBar() {
  return (
    <div className="rounded-2xl bg-slate-900/60 p-2 ring-1 ring-white/10">
      <div className="flex items-center gap-3 rounded-xl bg-slate-950/60 px-4 py-3">
        <Icon name="search" className="h-5 w-5 text-slate-500" />
        <span className="min-w-0 flex-1 truncate text-base text-slate-100">xue</span>
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-2 pt-2">
        {FILTERS.map((f, i) => (
          <span
            key={f}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
              i === 0 ? "bg-white/10 text-slate-100" : "text-slate-500"
            }`}
          >
            {f}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">
          16 resultados · <span className="text-slate-300">{COUNTS.queued}</span> na fila
        </span>
      </div>
    </div>
  );
}

function ResultsTable() {
  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900/50 ring-1 ring-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 bg-slate-950/40 text-left text-[10px] tracking-wide text-slate-500 uppercase">
            <th className="py-2.5 pl-4 font-medium">Hanzi</th>
            <th className="py-2.5 font-medium">Pinyin</th>
            <th className="py-2.5 font-medium">Definições</th>
            <th className="py-2.5 font-medium">HSK</th>
            <th className="py-2.5 pr-4 text-right font-medium">Fila</th>
          </tr>
        </thead>
        <tbody>
          {DICTIONARY.slice(0, 7).map((entry, i) => (
            <tr key={entry.id} className="border-b border-white/5 last:border-0">
              <td className="py-2 pl-4">
                <span className="font-hanzi text-lg leading-none text-slate-100" lang="zh-Hans">
                  {entry.simplified}
                </span>
              </td>
              <td className="py-2 text-xs text-slate-400">{entry.pinyin}</td>
              <td className="max-w-64 truncate py-2 text-xs text-slate-300">
                {entry.definitions.join("; ")}
              </td>
              <td className="py-2">
                <HsxChip level={entry.hsk_level} />
              </td>
              <td className="py-2 pr-4 text-right">
                <EnqueueButton enqueued={QUEUE_IDS.has(entry.id)} addedNow={i === 2} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-white/5 px-4 py-3">
        <Pager page={1} pageSize={7} total={16} />
      </div>
    </div>
  );
}

function ActivityFeed({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-white/5">
        <div className="flex items-center gap-2">
          <Icon name="file" className="h-4 w-4 text-accent-400" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">
            {BATCH_FILE}
          </span>
          <span className="text-[10px] text-slate-500 tabular-nums">412/1.000</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-[41%] rounded-full bg-accent-500" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FEED_FILTERS.map((f, i) => (
          <span
            key={f}
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              i === 0 ? "bg-white/10 text-slate-200" : "text-slate-500"
            }`}
          >
            {f}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-white/5">
        {BATCH_OUTCOMES.slice(0, 5).map((outcome) => (
          <li key={outcome.row} className="py-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-hanzi text-slate-100" lang="zh-Hans">
                {outcome.hanzi}
              </span>
              <span className="text-slate-400">{outcome.pinyin}</span>
              <span className="ml-auto">
                <StatusPill status={outcome.status} />
              </span>
            </div>
            {outcome.candidates.length > 0 && (
              <CandidatePicker candidates={outcome.candidates} compact />
            )}
            {outcome.candidates.length === 0 && outcome.detail && (
              <p className="mt-0.5 text-[10px] text-slate-500">{outcome.detail}</p>
            )}
          </li>
        ))}
      </ul>

      {expanded ? (
        <LoadMore shown={5} total={1000} />
      ) : (
        <span className="flex items-center justify-center gap-1 rounded-lg border border-white/10 py-1.5 text-[11px] font-medium text-slate-300">
          Ver resultado completo <Icon name="chevron-right" className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function ImportDrawer({ onClose }: { onClose: () => void }) {
  return (
    <aside className="fixed top-16 right-0 bottom-0 z-30 flex w-[420px] flex-col border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-white">Importar CSV</h2>
          <p className="text-[10px] text-slate-500">hanzi,pinyin · uma linha por item</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar importação">
          <Icon name="close" className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="rounded-xl border border-dashed border-white/15 bg-slate-900/40 px-3 py-3 text-center">
          <Icon name="upload" className="mx-auto h-5 w-5 text-slate-400" />
          <p className="mt-1 text-xs font-medium text-slate-200">Arraste o CSV ou escolha</p>
          <p className="text-[10px] text-slate-500">até 1.000 linhas · cabeçalho opcional</p>
        </div>

        <div>
          <p className="mb-1 text-[10px] tracking-wide text-slate-500 uppercase">ou cole o CSV</p>
          <pre className="rounded-lg bg-slate-900/70 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 ring-1 ring-white/5">
            {BATCH_TEXT}
          </pre>
          <p className="mt-1 text-[10px] text-slate-500">
            1.000 linhas reconhecidas · 1 com ambiguidade
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white">
            Importar 1.000 linhas
          </span>
          <span className="text-[10px] text-slate-500">envio linha a linha, ao vivo</span>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
            <span className="tracking-wide uppercase">Resultado</span>
            <span className="tabular-nums">412 de 1.000</span>
          </div>
          <SummaryTiles created={287} skipped={96} errors={29} />
        </div>

        <ul className="divide-y divide-white/5 rounded-lg bg-slate-900/40 px-3 ring-1 ring-white/5">
          {BATCH_OUTCOMES.slice(0, 5).map((outcome) => (
            <li key={outcome.row} className="py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-6 text-[10px] text-slate-600 tabular-nums">{outcome.row}</span>
                <span className="font-hanzi text-slate-100" lang="zh-Hans">
                  {outcome.hanzi}
                </span>
                <span className="text-slate-400">{outcome.pinyin}</span>
                <span className="ml-auto">
                  <StatusPill status={outcome.status} />
                </span>
              </div>
              {outcome.candidates.length > 0 && (
                <CandidatePicker candidates={outcome.candidates} compact />
              )}
            </li>
          ))}
        </ul>
        <Pager page={1} pageSize={25} total={1000} />
      </div>
    </aside>
  );
}

function MobileVariant() {
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<"result">("result");
  return (
    <MobileChrome>
      <div className="relative h-full">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-white">Biblioteca</h1>
              <p className="text-[11px] text-slate-500">
                {COUNTS.queued} na fila · {DICTIONARY.length} no dicionário
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setTab("result");
                setSheet(true);
              }}
              className="flex items-center gap-1 rounded-lg bg-accent-500 px-2.5 py-1.5 text-[11px] font-semibold text-white"
            >
              <Icon name="upload" className="h-3.5 w-3.5" />
              Importar
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 ring-1 ring-white/10">
            <Icon name="search" className="h-4 w-4 text-slate-500" />
            <span className="flex-1 text-sm text-slate-100">xue</span>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTERS.map((f, i) => (
              <span
                key={f}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium ${
                  i === 0 ? "bg-white/10 text-slate-200" : "text-slate-500"
                }`}
              >
                {f}
              </span>
            ))}
          </div>

          <ul className="space-y-1.5">
            {DICTIONARY.slice(0, 5).map((entry, i) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-xl bg-slate-900/60 p-2.5 ring-1 ring-white/5"
              >
                <EntryIdentity
                  simplified={entry.simplified}
                  pinyin={entry.pinyin}
                  definitions={entry.definitions}
                  size="sm"
                />
                <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                  <HsxChip level={entry.hsk_level} />
                  <EnqueueButton enqueued={QUEUE_IDS.has(entry.id)} addedNow={i === 2} />
                </div>
              </li>
            ))}
          </ul>
          <LoadMore shown={5} total={16} />
        </div>

        {sheet && (
          <div className="absolute inset-0 z-20">
            <div className="h-[38%] bg-black/50" />
            <div className="flex h-[62%] flex-col rounded-t-2xl border-t border-white/10 bg-slate-950">
              <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
                <span className="mx-auto h-1 w-10 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-4 pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-white">Importar CSV</h2>
                  <p className="text-[10px] text-slate-500">hanzi,pinyin · linha a linha</p>
                </div>
                <button type="button" onClick={() => setSheet(false)} aria-label="Fechar">
                  <Icon name="close" className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-4">
                <div className="rounded-xl border border-dashed border-white/15 bg-slate-900/40 px-3 py-2.5 text-center">
                  <p className="text-xs font-medium text-slate-200">{BATCH_FILE}</p>
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    1.000 linhas · 1 ambígua
                  </p>
                </div>
                <SummaryTiles created={287} skipped={96} errors={29} />
                <div className="flex gap-1.5">
                  {FEED_FILTERS.map((f, i) => (
                    <span
                      key={f}
                      className={`rounded px-2 py-0.5 text-[10px] ${
                        i === 0 ? "bg-white/10 text-slate-200" : "text-slate-500"
                      }`}
                    >
                      {f}
                      {tab === "result" ? "" : ""}
                    </span>
                  ))}
                </div>
                <ul className="space-y-1.5">
                  {BATCH_OUTCOMES.slice(0, 3).map((outcome) => (
                    <li
                      key={outcome.row}
                      className="rounded-lg bg-slate-900/60 p-2 ring-1 ring-white/5"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-hanzi text-slate-100" lang="zh-Hans">
                          {outcome.hanzi}
                        </span>
                        <span className="text-slate-400">{outcome.pinyin}</span>
                        <span className="ml-auto">
                          <StatusPill status={outcome.status} />
                        </span>
                      </div>
                      {outcome.candidates.length > 0 && (
                        <CandidatePicker candidates={outcome.candidates} compact />
                      )}
                    </li>
                  ))}
                </ul>
                <LoadMore shown={3} total={1000} />
              </div>
            </div>
          </div>
        )}
      </div>
    </MobileChrome>
  );
}

function DesktopVariant() {
  const [drawer, setDrawer] = useState(true);
  return (
    <AppChrome>
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">Biblioteca</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Itens de estudo</h1>
            <p className="mt-1 text-sm text-slate-400">
              Busque para adicionar, ou importe um lote sem sair da biblioteca.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-white"
          >
            <Icon name="upload" className="h-4 w-4" />
            Importar CSV
          </button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
          <div className="space-y-3">
            <SearchCommandBar />
            <ResultsTable />
          </div>
          <Card title="Atividade de importação" hint="Últimas linhas do lote em andamento">
            <ActivityFeed />
          </Card>
        </div>

        {drawer && <ImportDrawer onClose={() => setDrawer(false)} />}
      </div>

      <div className="mx-auto max-w-6xl border-t border-white/10 px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Mobile — busca primeiro, importação em folha inferior
        </h2>
        <PhoneFrame caption="A biblioteca é a busca; “Importar” abre uma bottom sheet com o lote e os resultados.">
          <MobileVariant />
        </PhoneFrame>
      </div>
    </AppChrome>
  );
}

export function CommandLibraryAddImport() {
  return <DesktopVariant />;
}
