// PROTOTYPE (wayfinder ticket #108) — Variant B "Fluxo em etapas".
// Search and CSV are two sources feeding one staging review: nothing is sent
// until the user confirms the combined list. Three steps, one table, one send.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { BATCH_FILE, BATCH_OUTCOMES, COUNTS, DICTIONARY } from "../addImportData.ts";
import {
  AppChrome,
  CandidatePicker,
  Card,
  EntryIdentity,
  MobileChrome,
  Pager,
  SearchField,
  StatusPill,
  SummaryTiles,
} from "../parts.tsx";

type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Origem" },
  { n: 2, label: "Revisar" },
  { n: 3, label: "Resultado" },
];

interface StagedRow {
  key: string;
  hanzi: string;
  pinyin: string;
  definitions: string[];
  via: "busca" | "csv";
  ambiguous?: boolean;
}

const STAGED: StagedRow[] = [
  {
    key: "s1",
    hanzi: "学习",
    pinyin: "xue2 xi2",
    definitions: ["to study", "to learn"],
    via: "busca",
  },
  {
    key: "s2",
    hanzi: "朋友",
    pinyin: "peng2 you3",
    definitions: ["friend"],
    via: "busca",
  },
  {
    key: "s3",
    hanzi: "时间",
    pinyin: "shi2 jian1",
    definitions: ["time", "period"],
    via: "busca",
  },
  {
    key: "c1",
    hanzi: "你好",
    pinyin: "ni3 hao3",
    definitions: ["hello", "hi"],
    via: "csv",
  },
  {
    key: "c2",
    hanzi: "汉字",
    pinyin: "han4 zi4",
    definitions: ["Chinese character"],
    via: "csv",
    ambiguous: true,
  },
  {
    key: "c3",
    hanzi: "谢谢",
    pinyin: "xie4 xie5",
    definitions: ["thanks", "thank you"],
    via: "csv",
  },
];

function Stepper({ step, onPick }: { step: Step; onPick: (s: Step) => void }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {STEPS.map((s, i) => {
        const state = s.n < step ? "done" : s.n === step ? "current" : "todo";
        return (
          <li key={s.n} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPick(s.n)}
              className={`flex items-center gap-2 rounded-full py-1 pr-3 pl-1 font-medium transition-colors ${
                state === "current"
                  ? "bg-white/10 text-white ring-1 ring-white/15"
                  : state === "done"
                    ? "text-slate-300"
                    : "text-slate-500"
              }`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] tabular-nums ${
                  state === "current"
                    ? "bg-accent-500 text-white"
                    : state === "done"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/5 text-slate-500"
                }`}
              >
                {state === "done" ? <Icon name="check" className="h-3 w-3" /> : s.n}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-8 bg-white/10" />}
          </li>
        );
      })}
    </ol>
  );
}

function StepSource() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-accent-500/40 bg-accent-500/5 p-4 ring-1 ring-accent-500/20">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-500/15 text-accent-300">
              <Icon name="search" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-100">Buscar no dicionário</p>
              <p className="text-[11px] text-slate-500">Item a item, com definições</p>
            </div>
            <Icon name="check" className="ml-auto h-4 w-4 text-accent-400" />
          </div>
          <div className="mt-3">
            <SearchField value="xue" compact />
          </div>
          <ul className="mt-2 space-y-1.5">
            {DICTIONARY.slice(0, 3).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-lg bg-slate-950/40 px-2 py-1.5 text-xs"
              >
                <span className="font-hanzi text-slate-100" lang="zh-Hans">
                  {entry.simplified}
                </span>
                <span className="text-slate-400">{entry.pinyin}</span>
                <span className="ml-auto text-[10px] font-medium text-accent-300">+ revisão</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/30 p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-slate-300">
              <Icon name="upload" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-slate-100">Importar CSV</p>
              <p className="text-[11px] text-slate-500">hanzi,pinyin · até 1.000 linhas</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-2 py-2 text-xs">
            <Icon name="file" className="h-4 w-4 text-slate-400" />
            <span className="truncate text-slate-300">{BATCH_FILE}</span>
            <span className="ml-auto shrink-0 text-[10px] text-slate-500 tabular-nums">
              1.000 linhas
            </span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
            Cada linha é casada com uma entrada; ambíguas aparecem na revisão para você escolher.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-slate-950/30 px-4 py-3 text-xs text-slate-400">
        <span className="font-medium text-slate-200">6 itens</span> entram na revisão — 3 da busca,
        3 do CSV.
      </div>
    </div>
  );
}

function StepReview() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="overflow-hidden rounded-xl ring-1 ring-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-950/40 text-left text-[10px] tracking-wide text-slate-500 uppercase">
              <th className="py-2 pl-3 font-medium">#</th>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Origem</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {STAGED.map((row, i) => (
              <tr key={row.key} className="border-t border-white/5 align-middle">
                <td className="py-2 pl-3 text-xs text-slate-600 tabular-nums">{i + 1}</td>
                <td className="py-2">
                  <EntryIdentity
                    simplified={row.hanzi}
                    pinyin={row.pinyin}
                    definitions={row.definitions}
                    size="sm"
                  />
                </td>
                <td className="py-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <Icon
                      name={row.via === "busca" ? "search" : "file"}
                      className="h-3.5 w-3.5 text-slate-500"
                    />
                    {row.via === "busca" ? "busca" : "CSV"}
                  </span>
                </td>
                <td className="py-2">
                  {row.ambiguous ? <StatusPill status="error" /> : <StatusPill status="pending" />}
                </td>
                <td className="py-2 pr-3 text-right">
                  <Icon name="trash" className="ml-auto h-4 w-4 text-slate-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 rounded-xl bg-slate-950/40 p-4 ring-1 ring-white/5">
        <div>
          <p className="text-[10px] tracking-wide text-slate-500 uppercase">Pronto para enviar</p>
          <p className="mt-1 text-3xl font-semibold text-white tabular-nums">
            6<span className="ml-1 text-sm font-normal text-slate-400">itens</span>
          </p>
        </div>
        <ul className="space-y-1.5 text-xs text-slate-400">
          <li className="flex items-center justify-between">
            <span>Da busca</span>
            <span className="text-slate-200 tabular-nums">3</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Do CSV</span>
            <span className="text-slate-200 tabular-nums">3</span>
          </li>
          <li className="flex items-center justify-between text-amber-300">
            <span className="flex items-center gap-1">
              <Icon name="alert" className="h-3.5 w-3.5" />
              Ambíguos
            </span>
            <span className="tabular-nums">1</span>
          </li>
        </ul>
        <div className="space-y-1.5 border-t border-white/5 pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 py-2 text-sm font-semibold text-white"
          >
            Enviar 6 itens <Icon name="arrow-right" className="h-4 w-4" />
          </button>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Ambíguos entram como erro e ficam resolvíveis no resultado, sem travar o lote.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepResult() {
  return (
    <div className="space-y-4">
      <SummaryTiles created={287} skipped={96} errors={29} />
      <div className="overflow-hidden rounded-xl ring-1 ring-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-950/40 text-left text-[10px] tracking-wide text-slate-500 uppercase">
              <th className="py-2 pl-3 font-medium">#</th>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {BATCH_OUTCOMES.slice(0, 6).map((outcome) => (
              <tr key={outcome.row} className="border-t border-white/5 align-top">
                <td className="py-2 pl-3 text-xs text-slate-600 tabular-nums">{outcome.row}</td>
                <td className="py-2">
                  <EntryIdentity
                    simplified={outcome.hanzi}
                    pinyin={outcome.pinyin}
                    definitions={[]}
                    size="sm"
                  />
                </td>
                <td className="py-2">
                  <StatusPill status={outcome.status} />
                </td>
                <td className="py-2 pr-3 text-xs text-slate-400">
                  {outcome.candidates.length > 0 ? (
                    <CandidatePicker candidates={outcome.candidates} compact />
                  ) : (
                    (outcome.detail ?? "—")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={1} pageSize={12} total={1000} />
    </div>
  );
}

function MobileVariant() {
  return (
    <MobileChrome>
      <div className="space-y-3 p-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Adicionar</h1>
          <p className="text-[11px] text-slate-500">Um fluxo · busca ou CSV</p>
        </div>

        <div className="flex items-center gap-1 text-[10px]">
          {STEPS.map((s) => (
            <span
              key={s.n}
              className={`flex items-center gap-1 rounded-full px-2 py-1 ${
                s.n === 2
                  ? "bg-accent-500 font-semibold text-white"
                  : s.n < 2
                    ? "text-emerald-300"
                    : "text-slate-500"
              }`}
            >
              {s.n < 2 ? <Icon name="check" className="h-3 w-3" /> : s.n}
              {s.label}
            </span>
          ))}
        </div>

        <ul className="space-y-1.5">
          {STAGED.slice(0, 5).map((row) => (
            <li key={row.key} className="rounded-xl bg-slate-900/60 p-2.5 ring-1 ring-white/5">
              <div className="flex items-center gap-2">
                <EntryIdentity
                  simplified={row.hanzi}
                  pinyin={row.pinyin}
                  definitions={row.definitions}
                  size="sm"
                />
                <span className="ml-auto shrink-0">
                  {row.ambiguous ? <StatusPill status="error" /> : <StatusPill status="pending" />}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="sticky bottom-0 -mx-1 rounded-xl border border-white/10 bg-slate-950/90 p-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Pronto para enviar</span>
            <span className="text-slate-100 tabular-nums">6 itens · 1 ambíguo</span>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-lg bg-accent-500 py-2 text-sm font-semibold text-white">
            Enviar 6 itens <Icon name="arrow-right" className="h-4 w-4" />
          </div>
        </div>
      </div>
    </MobileChrome>
  );
}

function DesktopVariant() {
  const [step, setStep] = useState<Step>(2);
  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">Biblioteca · Adicionar</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Adicionar à biblioteca</h1>
          </div>
          <span className="text-xs text-slate-500">
            Fila atual · <span className="text-slate-300 tabular-nums">{COUNTS.queued}</span>
          </span>
        </div>

        <Stepper step={step} onPick={setStep} />

        <Card
          title={STEPS.find((s) => s.n === step)?.label}
          hint={
            step === 1
              ? "Escolha a origem dos itens"
              : step === 2
                ? "Revise o lote combinado antes de enviar"
                : "Resultado linha a linha, com ambíguos resolvíveis"
          }
          action={
            step > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                {step === 2 ? "Voltar" : "Nova importação"}
              </span>
            ) : undefined
          }
        >
          {step === 1 && <StepSource />}
          {step === 2 && <StepReview />}
          {step === 3 && <StepResult />}
        </Card>
      </main>

      <div className="mx-auto max-w-6xl border-t border-white/10 px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold tracking-wide text-slate-500 uppercase">
          Mobile — o mesmo fluxo em cartões
        </h2>
        <PhoneFrame caption="Etapas compactas no topo, revisão em cartões e barra de envio fixa embaixo.">
          <MobileVariant />
        </PhoneFrame>
      </div>
    </AppChrome>
  );
}

export function StepperAddImport() {
  return <DesktopVariant />;
}
