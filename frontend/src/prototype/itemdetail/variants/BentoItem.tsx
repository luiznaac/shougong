// Variant F — "Bento" (wayfinder #110). A dashboard of bounded tiles: identity
// header from B/C, trajectory strip from C, and every list — related words and
// the generated readings that contain the word — lives in its own tile with its
// own arrows, so the page reads as a dashboard and never as an endless column.

import { useState } from "react";
import type { ReactNode } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, READINGS, RELATED } from "../itemDetailData.ts";
import {
  AppChrome,
  ArrowButton,
  BadgeRow,
  ChartLegend,
  FormatChip,
  FxChart,
  HskChip,
  ItemGlyph,
  LevelChip,
  LoadMore,
  MobileChrome,
  PriorityBar,
  ReadingDetail,
  ReadingRow,
  ReadingSnippet,
  RelatedRow,
  SnapshotCard,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

const STRIP_PER_PAGE = 3;
const REL_PER_PAGE = 4;
const READ_PER_PAGE = 2;
const MOBILE_STEP = 4;

function Tile({
  title,
  meta,
  action,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10 ${className}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{title}</h2>
        {meta && <span className="text-[11px] tabular-nums text-slate-500">{meta}</span>}
        {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function Dots({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Página ${n}`}
          onClick={() => onChange(n)}
          className={`h-1.5 rounded-full transition-all ${
            n === page ? "w-4 bg-accent-500" : "w-1.5 bg-white/15"
          }`}
        />
      ))}
    </div>
  );
}

function BentoDesktop() {
  const [stripPage, setStripPage] = useState(1);
  const [relPage, setRelPage] = useState(1);
  const [readPage, setReadPage] = useState(1);

  const stripRows = HISTORY.slice((stripPage - 1) * STRIP_PER_PAGE, stripPage * STRIP_PER_PAGE);
  const stripPages = Math.ceil(HISTORY.length / STRIP_PER_PAGE);
  const relRows = RELATED.slice((relPage - 1) * REL_PER_PAGE, relPage * REL_PER_PAGE);
  const relPages = Math.ceil(RELATED.length / REL_PER_PAGE);
  const readRows = READINGS.slice((readPage - 1) * READ_PER_PAGE, readPage * READ_PER_PAGE);
  const readPages = Math.ceil(READINGS.length / READ_PER_PAGE);

  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="book" className="h-3.5 w-3.5" />
          <span>Biblioteca</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
        </div>

        <header className="flex flex-wrap items-center gap-6 pb-5">
          <div className="flex items-center gap-5">
            <ItemGlyph item={ITEM} singleCharPx={88} boxPx={250} />
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
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <PriorityBar compact />
          </div>
        </header>

        <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 border-y border-white/10 py-3">
          {FACTS.map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="text-sm tabular-nums text-slate-200">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Tile
            title="Trajetória"
            meta={`${HISTORY.length} snapshots`}
            className="lg:col-span-2"
            action={
              <>
                <Dots page={stripPage} pages={stripPages} onChange={setStripPage} />
                <ArrowButton
                  dir={-1}
                  disabled={stripPage === 1}
                  onClick={() => setStripPage(stripPage - 1)}
                />
                <ArrowButton
                  dir={1}
                  disabled={stripPage === stripPages}
                  onClick={() => setStripPage(stripPage + 1)}
                />
              </>
            }
          >
            <ChartLegend />
            <FxChart history={HISTORY} height={132} />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {stripRows.map((row) => (
                <SnapshotCard key={row.created_at} row={row} />
              ))}
            </div>
          </Tile>

          <Tile title="Traços" meta="2 caracteres">
            <div className="flex h-full items-center justify-center">
              <StrokeMock sizePx={140} />
            </div>
          </Tile>

          <Tile
            title="Relacionados"
            meta={`${RELATED.length} palavras`}
            action={
              <>
                <span className="text-[11px] tabular-nums text-slate-500">
                  {relPage}/{relPages}
                </span>
                <ArrowButton
                  dir={-1}
                  disabled={relPage === 1}
                  onClick={() => setRelPage(relPage - 1)}
                />
                <ArrowButton
                  dir={1}
                  disabled={relPage === relPages}
                  onClick={() => setRelPage(relPage + 1)}
                />
              </>
            }
          >
            <ul className="divide-y divide-white/5">
              {relRows.map((entry) => (
                <li key={entry.id}>
                  <RelatedRow entry={entry} />
                </li>
              ))}
            </ul>
          </Tile>

          <Tile
            title={`Leituras com ${ITEM.entry.simplified}`}
            meta={`${READINGS.length}`}
            className="lg:col-span-2"
            action={
              <>
                <span className="text-[11px] tabular-nums text-slate-500">
                  {readPage}/{readPages}
                </span>
                <ArrowButton
                  dir={-1}
                  disabled={readPage === 1}
                  onClick={() => setReadPage(readPage - 1)}
                />
                <ArrowButton
                  dir={1}
                  disabled={readPage === readPages}
                  onClick={() => setReadPage(readPage + 1)}
                />
              </>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {readRows.map((reading) => (
                <div
                  key={reading.id}
                  className="flex flex-col rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5"
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
                  <div className="mt-auto flex items-center gap-2 pt-2 text-[10px] text-slate-500">
                    <span>{reading.tokens} tokens</span>
                    {reading.extraWords.length > 0 && (
                      <span className="text-amber-400">+{reading.extraWords.length} extras</span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-accent-300">
                      Abrir
                      <Icon name="arrow-right" className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Tile>
        </div>
      </main>
    </AppChrome>
  );
}

function BentoMobile() {
  const [relShown, setRelShown] = useState(MOBILE_STEP);
  const [readShown, setReadShown] = useState(3);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = READINGS.find((r) => r.id === selectedId) ?? null;

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

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-y border-white/10 py-2.5">
          {FACTS.slice(0, 4).map(([label, value]) => (
            <div key={label}>
              <div className="text-[9px] tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="text-[11px] tabular-nums text-slate-200">{value}</div>
            </div>
          ))}
        </div>

        <PriorityBar compact />

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Trajetória
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {HISTORY.length} snapshots
            </span>
          </summary>
          <div className="px-3 pb-3">
            <FxChart history={HISTORY} height={110} />
            <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {HISTORY.slice(0, 9).map((row) => (
                <div key={row.created_at} className="w-36 shrink-0 snap-start">
                  <SnapshotCard row={row} />
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="cursor-pointer px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Ordem dos traços
          </summary>
          <div className="px-3 pb-4">
            <StrokeMock sizePx={130} />
          </div>
        </details>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Relacionados
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {RELATED.length}
            </span>
          </summary>
          <div className="px-3 pb-3">
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
              onMore={() => setRelShown(relShown + MOBILE_STEP)}
            />
          </div>
        </details>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Leituras com{" "}
            <span lang="zh-Hans" className="font-hanzi text-slate-200">
              {ITEM.entry.simplified}
            </span>
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {READINGS.length}
            </span>
          </summary>
          <div className="px-3 pb-3">
            <div className="divide-y divide-white/5">
              {READINGS.slice(0, readShown).map((reading) => (
                <div key={reading.id}>
                  <ReadingRow
                    reading={reading}
                    selected={reading.id === selectedId}
                    onSelect={() => setSelectedId(selectedId === reading.id ? null : reading.id)}
                  />
                  {selected?.id === reading.id && (
                    <div className="pb-2">
                      <ReadingDetail reading={reading} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <LoadMore
              shown={readShown}
              total={READINGS.length}
              onMore={() => setReadShown(readShown + 2)}
            />
          </div>
        </details>
      </div>
    </MobileChrome>
  );
}

export function BentoItem() {
  return (
    <>
      <BentoDesktop />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Bento no celular: os tiles viram cartões em acordeão; trajetória e leituras continuam com rolagem horizontal e 'Carregar mais'.">
            <BentoMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
