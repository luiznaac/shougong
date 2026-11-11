// Variant H — "Dois modos" (wayfinder #110). One centred editorial column with a
// mode switch: **Contexto** (the default — readings that use the word, related
// words, strokes) and **Progresso** (facts, chart, snapshot history). Trajectory
// is a mode you enter, not the page's headline.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, READINGS, RELATED } from "../itemDetailData.ts";
import {
  AppChrome,
  BadgeRow,
  ChartLegend,
  FactsStrip,
  FormatChip,
  FxChart,
  HskChip,
  ItemGlyph,
  LevelChip,
  LoadMore,
  MobileChrome,
  Pager,
  PriorityBar,
  ReadingSnippet,
  RelatedRow,
  SnapshotTable,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

type Mode = "context" | "progress";

const READ_PER_PAGE = 3;
const REL_PER_PAGE = 8;
const HIST_PER_PAGE = 8;
const MOBILE_STEP = 3;

function ModeSwitch({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex overflow-hidden rounded-lg border border-white/10 bg-slate-900/60 p-0.5 text-xs">
        {[
          ["context", "Contexto"],
          ["progress", "Progresso"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onMode(key as Mode)}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === key ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-slate-500">
        {mode === "context"
          ? `${READINGS.length} leituras · ${RELATED.length} palavras`
          : `${HISTORY.length} snapshots`}
      </span>
    </div>
  );
}

function ReadingFeed({ rows }: { rows: typeof READINGS }) {
  return (
    <ul className="space-y-2.5">
      {rows.map((reading) => (
        <li
          key={reading.id}
          className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/5 transition-colors hover:bg-white/[0.05]"
        >
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <FormatChip format={reading.format} />
            <span className="truncate">{reading.topic ?? "tema sorteado"}</span>
            <span className="ml-auto shrink-0 tabular-nums">
              {new Date(reading.created_at).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          </div>
          <div className="mt-2">
            <ReadingSnippet reading={reading} size="base" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
            <span>{reading.tokens} tokens</span>
            {reading.extraWords.length > 0 ? (
              <span className="text-amber-400">
                {reading.extraWords.join(" ")} fora do vocabulário
              </span>
            ) : (
              <span className="text-emerald-300/80">só vocabulário conhecido</span>
            )}
            <span className="ml-auto flex items-center gap-1 text-accent-300">
              Abrir na Leitura
              <Icon name="arrow-right" className="h-3 w-3" />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EditorialHeader() {
  return (
    <header className="pb-5">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-5">
          <ItemGlyph item={ITEM} singleCharPx={84} boxPx={250} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-white">{ITEM.entry.definitions[0]}</h1>
              <BadgeRow item={ITEM} />
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {ITEM.entry.definitions.slice(1).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <HskChip level={ITEM.entry.hsk_level} />
              <StateChip state={ITEM.card.state} />
              <LevelChip item={ITEM} />
              <span className="text-[11px] text-slate-500">· estab. 21,4 d</span>
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <PriorityBar compact />
        </div>
      </div>
    </header>
  );
}

function ContextDesktop() {
  const [readPage, setReadPage] = useState(1);
  const [relPage, setRelPage] = useState(1);
  const readRows = READINGS.slice((readPage - 1) * READ_PER_PAGE, readPage * READ_PER_PAGE);
  const relRows = RELATED.slice((relPage - 1) * REL_PER_PAGE, relPage * REL_PER_PAGE);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Leituras com{" "}
            <span lang="zh-Hans" className="font-hanzi text-slate-200">
              {ITEM.entry.simplified}
            </span>
          </h2>
          <span className="text-[11px] tabular-nums text-slate-500">
            {(readPage - 1) * READ_PER_PAGE + 1}–
            {Math.min(readPage * READ_PER_PAGE, READINGS.length)} de {READINGS.length}
          </span>
        </div>
        <ReadingFeed rows={readRows} />
        <div className="mt-3">
          <Pager
            page={readPage}
            pages={Math.ceil(READINGS.length / READ_PER_PAGE)}
            onChange={setReadPage}
            label="Leituras geradas"
          />
        </div>
      </section>

      <section className="border-t border-white/10 pt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Relacionados
          </h2>
          <span className="text-[11px] tabular-nums text-slate-500">{RELATED.length} palavras</span>
        </div>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {relRows.map((entry) => (
            <div key={entry.id} className="border-b border-white/5">
              <RelatedRow entry={entry} />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Pager
            page={relPage}
            pages={Math.ceil(RELATED.length / REL_PER_PAGE)}
            onChange={setRelPage}
            label="Palavras relacionadas"
          />
        </div>
      </section>

      <section className="border-t border-white/10 pt-5">
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Ordem dos traços
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <StrokeMock sizePx={140} />
          <p className="max-w-xs text-sm text-slate-400">
            Um traço por vez; escolha o caractere acima do quadro. Sem animação automática.
          </p>
        </div>
      </section>
    </div>
  );
}

function ProgressDesktop() {
  const [page, setPage] = useState(1);
  const rows = HISTORY.slice((page - 1) * HIST_PER_PAGE, page * HIST_PER_PAGE);
  return (
    <div className="space-y-5">
      <FactsStrip facts={FACTS} />
      <div>
        <ChartLegend />
        <FxChart history={HISTORY} height={190} />
      </div>
      <SnapshotTable rows={rows} />
      <div className="border-t border-white/5 pt-3">
        <Pager
          page={page}
          pages={Math.ceil(HISTORY.length / HIST_PER_PAGE)}
          onChange={setPage}
          label={`${(page - 1) * HIST_PER_PAGE + 1}–${Math.min(
            page * HIST_PER_PAGE,
            HISTORY.length,
          )} de ${HISTORY.length} snapshots`}
        />
      </div>
    </div>
  );
}

function ModeDesktop() {
  const [mode, setMode] = useState<Mode>("context");
  return (
    <AppChrome>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="book" className="h-3.5 w-3.5" />
          <span>Biblioteca</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
        </div>
        <EditorialHeader />
        <div className="mb-5 flex items-center justify-between border-y border-white/10 py-3">
          <ModeSwitch mode={mode} onMode={setMode} />
        </div>
        {mode === "context" ? <ContextDesktop /> : <ProgressDesktop />}
      </main>
    </AppChrome>
  );
}

function ModeMobile() {
  const [mode, setMode] = useState<Mode>("context");
  const [readShown, setReadShown] = useState(MOBILE_STEP);
  const [relShown, setRelShown] = useState(4);
  const [historyShown, setHistoryShown] = useState(6);

  return (
    <MobileChrome>
      <div className="space-y-3 p-4">
        <button type="button" className="flex items-center gap-1 text-[11px] text-slate-400">
          <Icon name="chevron-left" className="h-3.5 w-3.5" />
          Biblioteca
        </button>

        <section className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 p-4 ring-1 ring-white/10">
          <div className="absolute top-3 right-3">
            <BadgeRow item={ITEM} />
          </div>
          <ItemGlyph item={ITEM} singleCharPx={56} boxPx={200} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
            <HskChip level={ITEM.entry.hsk_level} />
            <StateChip state={ITEM.card.state} />
            <LevelChip item={ITEM} />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            {ITEM.entry.definitions.join(" · ")}
          </p>
        </section>

        <PriorityBar compact />

        <div className="border-y border-white/10 py-2">
          <ModeSwitch mode={mode} onMode={setMode} />
        </div>

        {mode === "context" ? (
          <div className="space-y-3">
            <div>
              <h2 className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Leituras com{" "}
                <span lang="zh-Hans" className="font-hanzi text-slate-200">
                  {ITEM.entry.simplified}
                </span>
              </h2>
              <ul className="space-y-2">
                {READINGS.slice(0, readShown).map((reading) => (
                  <li
                    key={reading.id}
                    className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <FormatChip format={reading.format} />
                      <span className="truncate">{reading.topic ?? "tema sorteado"}</span>
                      <span className="ml-auto shrink-0 tabular-nums">
                        {new Date(reading.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ReadingSnippet reading={reading} />
                    </div>
                  </li>
                ))}
              </ul>
              <LoadMore
                shown={readShown}
                total={READINGS.length}
                onMore={() => setReadShown(readShown + MOBILE_STEP)}
              />
            </div>

            <div>
              <h2 className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Relacionados
              </h2>
              <ul className="divide-y divide-white/5">
                {RELATED.slice(0, relShown).map((entry) => (
                  <li key={entry.id}>
                    <RelatedRow entry={entry} />
                  </li>
                ))}
              </ul>
              <LoadMore
                shown={relShown}
                total={RELATED.length}
                onMore={() => setRelShown(relShown + 4)}
              />
            </div>

            <details className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
              <summary className="cursor-pointer px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                Ordem dos traços
              </summary>
              <div className="px-3 pb-4">
                <StrokeMock sizePx={130} />
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-3">
            <FactsStrip facts={FACTS} />
            <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
              <ChartLegend />
              <FxChart history={HISTORY} height={130} />
            </section>
            <div className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
              <div className="divide-y divide-white/5">
                {HISTORY.slice(0, historyShown).map((row) => (
                  <div key={row.created_at} className="flex items-center justify-between py-2">
                    <span className="text-[11px] tabular-nums text-slate-300">
                      {new Date(row.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <StateChip state={row.state} />
                    <span className="text-[11px] tabular-nums text-slate-400">
                      {row.stability.toFixed(1)} d
                    </span>
                  </div>
                ))}
              </div>
              <LoadMore
                shown={historyShown}
                total={HISTORY.length}
                onMore={() => setHistoryShown(historyShown + 6)}
              />
            </div>
          </div>
        )}
      </div>
    </MobileChrome>
  );
}

export function ModeSwitchItem() {
  return (
    <>
      <ModeDesktop />
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Dois modos no celular: Contexto é o padrão (leituras + relacionadas + traços); Progresso é um modo separado.">
            <ModeMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
