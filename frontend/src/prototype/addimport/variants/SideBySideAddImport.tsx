// PROTOTYPE (wayfinder ticket #108) — Variant A "Lado a lado".
// Both surfaces of the workflow are visible at once: dictionary search on the
// left, CSV import + live per-row results on the right, one shared queue counter.
// Desktop keeps tables; mobile swaps to a segmented control and card lists.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { BATCH_FILE, BATCH_OUTCOMES, COUNTS, DICTIONARY, QUEUE_IDS } from "../addImportData.ts";
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
  SearchField,
  StatusPill,
  SummaryTiles,
} from "../parts.tsx";

const SEARCH_RESULTS = DICTIONARY.slice(0, 5);
const PAGE_ROWS = BATCH_OUTCOMES.slice(0, 8);

function SearchPane() {
  return (
    <Card
      title="Buscar no dicionário"
      hint="16 entradas para “xue” · clique para enfileirar"
      action={
        <span className="text-[11px] text-slate-500">
          <Icon name="layers" className="mr-1 inline h-3.5 w-3.5" />
          Fila · {COUNTS.queued}
        </span>
      }
    >
      <div className="space-y-3">
        <SearchField value="xue" />
        <ul className="divide-y divide-white/5">
          {SEARCH_RESULTS.map((entry, i) => {
            const enqueued = QUEUE_IDS.has(entry.id);
            return (
              <li key={entry.id} className="flex items-center gap-3 py-2.5">
                <EntryIdentity
                  simplified={entry.simplified}
                  pinyin={entry.pinyin}
                  definitions={entry.definitions}
                />
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <HsxChip level={entry.hsk_level} />
                  <EnqueueButton enqueued={enqueued} addedNow={i === 1} />
                </div>
              </li>
            );
          })}
        </ul>
        <Pager page={1} pageSize={5} total={16} />
      </div>
    </Card>
  );
}

function ImportPane() {
  return (
    <Card
      title="Importar CSV"
      hint="hanzi,pinyin · uma linha por item"
      action={
        <span className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">
          <Icon name="upload" className="h-3.5 w-3.5" />
          Escolher arquivo
        </span>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-slate-950/40 px-3 py-2.5">
          <Icon name="file" className="h-5 w-5 text-accent-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">{BATCH_FILE}</p>
            <p className="text-[10px] text-slate-500 tabular-nums">
              1.000 linhas · 4 KB · cabeçalho detectado
            </p>
          </div>
          <Icon name="close" className="h-4 w-4 text-slate-500" />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              Importando… <span className="tabular-nums text-slate-200">412</span> de 1.000
            </span>
            <span className="tabular-nums text-slate-500">41%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-[41%] rounded-full bg-accent-500" />
          </div>
        </div>

        <SummaryTiles created={287} skipped={96} errors={29} />

        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Últimas linhas
          </p>
          <ul className="divide-y divide-white/5 text-xs">
            {PAGE_ROWS.map((outcome) => (
              <li key={outcome.row} className="py-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 tabular-nums text-slate-600">
                    {String(outcome.row).padStart(3, "0")}
                  </span>
                  <span className="font-hanzi text-slate-100" lang="zh-Hans">
                    {outcome.hanzi}
                  </span>
                  <span className="text-slate-400">{outcome.pinyin}</span>
                  <span className="ml-auto">
                    <StatusPill status={outcome.status} />
                  </span>
                </div>
                {outcome.candidates.length > 0 && (
                  <div className="ml-8">
                    <CandidatePicker candidates={outcome.candidates} compact />
                  </div>
                )}
                {outcome.candidates.length === 0 && outcome.detail && (
                  <p className="ml-8 mt-0.5 text-[10px] text-slate-500">{outcome.detail}</p>
                )}
              </li>
            ))}
          </ul>
          <Pager page={1} pageSize={12} total={1000} />
        </div>
      </div>
    </Card>
  );
}

function DesktopVariant() {
  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">Biblioteca · Adicionar</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Adicionar à biblioteca</h1>
            <p className="mt-1 text-sm text-slate-400">
              Busque no dicionário ou importe um CSV. Tudo cai na mesma fila de lições.
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
            <Icon name="layers" className="h-4 w-4 text-accent-400" />
            <span className="tabular-nums text-slate-200">{COUNTS.queued}</span> na fila
          </span>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr]">
          <SearchPane />
          <ImportPane />
        </div>
      </main>

      <div className="mx-auto max-w-6xl border-t border-white/10 px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Mobile — controle segmentado e listas em cartão
        </h2>
        <PhoneFrame caption="Duas abas no topo; busca em cartões com “Carregar mais” e importação com progresso e resultados por linha.">
          <MobileVariant />
        </PhoneFrame>
      </div>
    </AppChrome>
  );
}

function MobileVariant() {
  const [tab, setTab] = useState<"search" | "import">("search");
  return (
    <MobileChrome>
      <div className="space-y-3 p-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Adicionar</h1>
          <p className="text-[11px] text-slate-500">
            {COUNTS.queued} itens na fila · busque ou importe
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1 text-xs font-medium">
          {(
            [
              ["search", "Buscar"],
              ["import", "Importar CSV"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-lg py-1.5 text-center ${
                tab === key ? "bg-accent-500 text-white" : "text-slate-400"
              }`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "search" ? (
          <div className="space-y-3">
            <SearchField value="xue" compact />
            <ul className="space-y-1.5">
              {DICTIONARY.slice(0, 4).map((entry, i) => {
                const enqueued = QUEUE_IDS.has(entry.id);
                return (
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
                      <EnqueueButton enqueued={enqueued} addedNow={i === 1} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <LoadMore shown={4} total={16} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-dashed border-white/15 bg-slate-900/40 p-3">
              <div className="flex items-center gap-2">
                <Icon name="file" className="h-5 w-5 text-accent-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{BATCH_FILE}</p>
                  <p className="text-[10px] text-slate-500 tabular-nums">1.000 linhas</p>
                </div>
                <Icon name="close" className="h-4 w-4 text-slate-500" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">
                  Importando… <span className="tabular-nums text-slate-200">412</span>/1.000
                </span>
                <span className="text-slate-500">41%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-[41%] rounded-full bg-accent-500" />
              </div>
            </div>
            <SummaryTiles created={287} skipped={96} errors={29} />
            <ul className="space-y-1.5">
              {BATCH_OUTCOMES.slice(0, 4).map((outcome) => (
                <li
                  key={outcome.row}
                  className="rounded-xl bg-slate-900/60 p-2.5 ring-1 ring-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-hanzi text-base text-slate-100" lang="zh-Hans">
                      {outcome.hanzi}
                    </span>
                    <span className="text-[11px] text-slate-400">{outcome.pinyin}</span>
                    <span className="ml-auto">
                      <StatusPill status={outcome.status} />
                    </span>
                  </div>
                  {outcome.candidates.length > 0 && (
                    <CandidatePicker candidates={outcome.candidates} compact />
                  )}
                  {outcome.candidates.length === 0 && outcome.detail && (
                    <p className="mt-1 text-[10px] text-slate-500">{outcome.detail}</p>
                  )}
                </li>
              ))}
            </ul>
            <LoadMore shown={4} total={1000} />
          </div>
        )}
      </div>
    </MobileChrome>
  );
}

export function SideBySideAddImport() {
  return <DesktopVariant />;
}
