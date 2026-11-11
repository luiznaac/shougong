// Variant K — "Bento validado, mobile-first" (wayfinder #110, validation pass).
// J's structure with three fixes: Leituras is G's pane in a true horizontal split,
// the mobile chart gets a mobile-sized viewBox (readable axes), and Traços is the
// first section on mobile.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, READINGS, RELATED } from "../itemDetailData.ts";
import {
  AppChrome,
  BadgeRow,
  ChartLegend,
  FxChartAxes,
  HskChip,
  ItemGlyph,
  LevelChip,
  LoadMore,
  MobileChrome,
  Pager,
  PriorityBar,
  ReadingDetail,
  ReadingRow,
  RelatedRow,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

const REL_PER_PAGE = 8;
const MOBILE_STEP = 4;

function EditorialHeader() {
  return (
    <header className="pb-5">
      <div className="flex flex-wrap items-center gap-6">
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
      </div>
    </header>
  );
}

function FactsLine() {
  return (
    <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 border-y border-white/10 py-3">
      {FACTS.map(([label, value]) => (
        <div key={label}>
          <div className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</div>
          <div className="text-sm tabular-nums text-slate-200">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ReadingsPane() {
  const [selectedId, setSelectedId] = useState(READINGS[0].id);
  const selected = READINGS.find((r) => r.id === selectedId) ?? READINGS[0];

  return (
    <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Leituras com{" "}
          <span lang="zh-Hans" className="font-hanzi text-slate-200">
            {ITEM.entry.simplified}
          </span>
        </h2>
        <span className="text-[11px] tabular-nums text-slate-500">{READINGS.length}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="max-h-[20rem] space-y-0.5 overflow-y-auto pr-1">
          {READINGS.map((reading) => (
            <ReadingRow
              key={reading.id}
              reading={reading}
              selected={reading.id === selectedId}
              onSelect={() => setSelectedId(reading.id)}
            />
          ))}
        </div>
        <div className="self-start">
          <ReadingDetail reading={selected} />
        </div>
      </div>
    </section>
  );
}

function RelatedGrid() {
  const [page, setPage] = useState(1);
  const rows = RELATED.slice((page - 1) * REL_PER_PAGE, page * REL_PER_PAGE);

  return (
    <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
          Relacionados
        </h2>
        <span className="text-[11px] tabular-nums text-slate-500">{RELATED.length} palavras</span>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {rows.map((entry) => (
          <div key={entry.id} className="border-b border-white/5">
            <RelatedRow entry={entry} />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Pager
          page={page}
          pages={Math.ceil(RELATED.length / REL_PER_PAGE)}
          onChange={setPage}
          label="Palavras relacionadas"
        />
      </div>
    </section>
  );
}

function TrajectoryCard() {
  return (
    <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Trajetória</h2>
        <ChartLegend />
      </div>
      <FxChartAxes history={HISTORY} height={250} />
    </section>
  );
}

function ValidatedDesktop() {
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

        <EditorialHeader />
        <FactsLine />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <TrajectoryCard />
            <ReadingsPane />
            <RelatedGrid />
          </div>

          <aside className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10 lg:sticky lg:top-24">
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Traços
            </h2>
            <StrokeMock sizePx={150} />
            <div className="mt-3 space-y-1 border-t border-white/5 pt-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">知</span>
                <span className="tabular-nums text-slate-300">8 traços</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">道</span>
                <span className="tabular-nums text-slate-300">12 traços</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </AppChrome>
  );
}

function ValidatedMobile() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = READINGS.find((r) => r.id === selectedId) ?? null;
  const [relShown, setRelShown] = useState(MOBILE_STEP);

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
          <summary className="cursor-pointer px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Ordem dos traços
          </summary>
          <div className="px-3 pb-4">
            <StrokeMock sizePx={150} />
          </div>
        </details>

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Trajetória
            </h2>
            <ChartLegend />
          </div>
          <FxChartAxes history={HISTORY} height={260} layout="mobile" />
        </section>

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
              {READINGS.slice(0, 4).map((reading) => (
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
            <p className="pt-2 text-[10px] text-slate-600">
              Toque numa leitura para abrir o trecho aqui mesmo.
            </p>
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
      </div>
    </MobileChrome>
  );
}

export function BentoMobileItem() {
  return (
    <>
      <ValidatedDesktop />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Mobile: Traços primeiro, gráfico com eixos legíveis, leituras em master-detail inline e relacionadas com 'Carregar mais'.">
            <ValidatedMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
