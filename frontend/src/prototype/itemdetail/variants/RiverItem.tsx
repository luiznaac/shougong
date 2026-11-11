// Variant I — "Rio de atividade" (wayfinder #110). Blends everything by dropping
// section silos: snapshots and generated readings become one chronological river
// for this word. Trajectory is no longer a hero chart — it is the shape of the
// river plus a sparkline in the progress card.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, READINGS, RELATED } from "../itemDetailData.ts";
import type { MockReading, MockSnapshot } from "../itemDetailData.ts";
import {
  AppChrome,
  ArrowButton,
  BadgeRow,
  HskChip,
  ItemGlyph,
  LevelChip,
  LoadMore,
  MobileChrome,
  Pager,
  PriorityBar,
  ReadingSnippet,
  RelatedRow,
  Sparkline,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

type RiverEvent =
  | { kind: "snapshot"; at: string; data: MockSnapshot }
  | { kind: "reading"; at: string; data: MockReading };

const EVENTS: RiverEvent[] = [
  ...HISTORY.map((s): RiverEvent => ({ kind: "snapshot", at: s.created_at, data: s })),
  ...READINGS.map((r): RiverEvent => ({ kind: "reading", at: r.created_at, data: r })),
].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

const PAGE_SIZE = 8;
const REL_PER_PAGE = 5;
const MOBILE_STEP = 6;

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function RiverDot({ kind }: { kind: RiverEvent["kind"] }) {
  const reading = kind === "reading";
  return (
    <span
      className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ${
        reading
          ? "bg-accent-500/15 text-accent-300 ring-accent-500/30"
          : "bg-slate-800/80 text-slate-400 ring-white/10"
      }`}
    >
      <Icon name={reading ? "text" : "clock"} className="h-3.5 w-3.5" />
    </span>
  );
}

function RiverEntry({ event }: { event: RiverEvent }) {
  if (event.kind === "reading") {
    const reading = event.data;
    return (
      <li className="relative flex gap-3 pb-5">
        <RiverDot kind="reading" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-medium text-slate-200">Leitura #{reading.id} gerada</p>
            <span className="text-[11px] text-slate-500">
              {reading.topic ?? "tema sorteado"} · {fmtDateTime(reading.created_at)}
            </span>
          </div>
          <div className="mt-1">
            <ReadingSnippet reading={reading} clamp />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
            <span>{reading.tokens} tokens</span>
            {reading.extraWords.length > 0 && (
              <span className="text-amber-400">
                {reading.extraWords.join(" ")} fora do vocabulário
              </span>
            )}
            <span className="ml-auto flex items-center gap-1 text-accent-300">
              Abrir na Leitura
              <Icon name="arrow-right" className="h-3 w-3" />
            </span>
          </div>
        </div>
      </li>
    );
  }

  const snap = event.data;
  return (
    <li className="relative flex gap-3 pb-5">
      <RiverDot kind="snapshot" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-sm font-medium text-slate-300">Snapshot FSRS</p>
          <StateChip state={snap.state} />
          <span className="text-[11px] text-slate-500">{fmtDateTime(snap.created_at)}</span>
        </div>
        <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">
          estab. {snap.stability.toFixed(1)} d · dificuldade {snap.difficulty.toFixed(2)} · próximo{" "}
          {new Date(snap.due).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </p>
      </div>
    </li>
  );
}

function ProgressMini({ withAction = false }: { withAction?: boolean }) {
  return (
    <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Progresso</h2>
        <LevelChip item={ITEM} />
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums text-slate-100">21,4 d</div>
          <div className="text-[11px] text-slate-500">dificuldade 4,82</div>
          <div className="mt-1 text-[11px] text-slate-400">próximo review 14 de nov</div>
        </div>
        <Sparkline history={HISTORY} className="h-11 w-28" />
      </div>
      {withAction && (
        <p className="mt-2 text-[10px] text-slate-600">
          A trajetória completa é o próprio rio abaixo.
        </p>
      )}
    </section>
  );
}

function RiverDesktop() {
  const [page, setPage] = useState(1);
  const [relPage, setRelPage] = useState(1);
  const events = EVENTS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const relRows = RELATED.slice((relPage - 1) * REL_PER_PAGE, relPage * REL_PER_PAGE);

  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl px-6 py-7">
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="book" className="h-3.5 w-3.5" />
          <span>Biblioteca</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
        </div>

        <header className="flex flex-wrap items-center gap-6 pb-5">
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
                <span className="text-[11px] text-slate-500">· criado 18/09</span>
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <PriorityBar compact />
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <section className="rounded-2xl bg-slate-900/40 p-5 ring-1 ring-white/10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Rio de atividade
              </h2>
              <span className="text-[11px] tabular-nums text-slate-500">
                {EVENTS.length} eventos
              </span>
            </div>
            <ul className="relative ml-3.5 border-l border-white/10 pl-4">
              {events.map((event) => (
                <RiverEntry key={`${event.kind}-${event.at}`} event={event} />
              ))}
            </ul>
            <div className="border-t border-white/5 pt-3">
              <Pager
                page={page}
                pages={Math.ceil(EVENTS.length / PAGE_SIZE)}
                onChange={setPage}
                label={`${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                  page * PAGE_SIZE,
                  EVENTS.length,
                )} de ${EVENTS.length} eventos`}
              />
            </div>
          </section>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <ProgressMini withAction />
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Relacionados
                </h2>
                <div className="flex items-center gap-1">
                  <ArrowButton
                    dir={-1}
                    disabled={relPage === 1}
                    onClick={() => setRelPage(relPage - 1)}
                  />
                  <span className="text-[10px] tabular-nums text-slate-500">
                    {relPage}/{Math.ceil(RELATED.length / REL_PER_PAGE)}
                  </span>
                  <ArrowButton
                    dir={1}
                    disabled={relPage === Math.ceil(RELATED.length / REL_PER_PAGE)}
                    onClick={() => setRelPage(relPage + 1)}
                  />
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {relRows.map((entry) => (
                  <RelatedRow key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Traços
              </h2>
              <StrokeMock sizePx={120} />
            </section>
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Fatos
              </h2>
              <dl className="space-y-1 text-[11px]">
                {FACTS.slice(2).map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2">
                    <dt className="truncate text-slate-500">{label}</dt>
                    <dd className="shrink-0 tabular-nums text-slate-300">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      </main>
    </AppChrome>
  );
}

function RiverMobile() {
  const [shown, setShown] = useState(MOBILE_STEP);
  const [relShown, setRelShown] = useState(4);

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

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[10px] tracking-wide text-slate-500 uppercase">Progresso</div>
              <div className="text-lg font-semibold tabular-nums text-slate-100">21,4 d</div>
              <div className="text-[10px] text-slate-500">próximo review 14 de nov</div>
            </div>
            <Sparkline history={HISTORY} className="h-9 w-24" />
          </div>
        </section>

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
              Rio de atividade
            </h2>
            <span className="text-[10px] tabular-nums text-slate-600">{EVENTS.length}</span>
          </div>
          <ul className="relative ml-3 border-l border-white/10 pl-3">
            {EVENTS.slice(0, shown).map((event) => (
              <RiverEntry key={`${event.kind}-${event.at}`} event={event} />
            ))}
          </ul>
          <LoadMore
            shown={shown}
            total={EVENTS.length}
            onMore={() => setShown(shown + MOBILE_STEP)}
          />
        </section>

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
              onMore={() => setRelShown(relShown + 4)}
            />
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
      </div>
    </MobileChrome>
  );
}

export function RiverItem() {
  return (
    <>
      <RiverDesktop />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Rio no celular: snapshots e leituras intercalados na mesma cronologia; a trajetória é um sparkline, não um gráfico.">
            <RiverMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
