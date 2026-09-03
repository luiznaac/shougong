import { Link, useParams } from "react-router-dom";
import { useItemHistory, useStudyItem } from "../api/queries.ts";
import { Pinyin } from "../components/Pinyin.tsx";
import { Hanzi } from "../components/Hanzi.tsx";
import { ItemMetricChart } from "../components/ItemMetricChart.tsx";
import { RelatedEntries } from "../components/RelatedEntries.tsx";
import { formatDate, formatDateTime } from "../lib/format.ts";
import { levelColor, levelLabel, levelOf } from "../lib/srs.ts";
import type { SrsState } from "../api/types.ts";

const FSRS_STATE_LABEL: Record<SrsState, string> = {
  learning: "Aprendendo",
  review: "Em revisão",
  relearning: "Reaprendendo",
};

export function StudyItemPage() {
  const { id } = useParams();
  const itemId = Number(id);
  const { data: item, isLoading, error } = useStudyItem(itemId);
  const { data: snapshots } = useItemHistory(itemId);

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (error) return <p className="text-rose-400">Falha ao carregar: {String(error)}</p>;
  if (!item) return null;

  const level = levelOf(item.card);

  return (
    <div className="space-y-8">
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-300">
        ← Painel
      </Link>

      <header className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-10">
        <Hanzi
          text={item.entry.simplified}
          singleCharPx={96}
          boxPx={360}
          className="text-slate-50"
        />
        <Pinyin value={item.entry.pinyin} className="text-3xl font-light" />
        <span
          className="rounded-full px-3 py-0.5 text-xs font-semibold text-white"
          style={{ background: levelColor(level) }}
        >
          {levelLabel(level)}
        </span>
      </header>

      <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Significados
        </h2>
        <ul className="list-inside list-disc space-y-1 text-slate-200">
          {item.entry.definitions.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Fact label="Estado FSRS" value={FSRS_STATE_LABEL[item.card.state]} />
        <Fact label="Próximo review" value={formatDate(item.card.due)} />
        <Fact
          label="Estabilidade"
          value={item.card.stability != null ? `${item.card.stability.toFixed(1)} d` : "—"}
        />
        <Fact
          label="Dificuldade"
          value={item.card.difficulty != null ? item.card.difficulty.toFixed(2) : "—"}
        />
        <Fact
          label="Último review"
          value={item.card.last_review ? formatDateTime(item.card.last_review) : "—"}
        />
        <Fact label="Adicionado" value={formatDateTime(item.created_at)} />
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Trajetória
        </h2>
        <ItemMetricChart history={snapshots ?? []} />
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Itens relacionados
        </h2>
        <RelatedEntries query={item.entry.simplified} excludeEntryId={item.entry.id} />
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-slate-200">{value}</div>
    </div>
  );
}
