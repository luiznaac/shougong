import { Link, useParams } from "react-router-dom";
import { useItemHistory, useReviewHistory, useStudyItem } from "../api/queries.ts";
import { Pinyin } from "../components/Pinyin.tsx";
import { formatDateTime, fromNow } from "../lib/format.ts";
import { levelColor, levelLabel, levelOf } from "../lib/srs.ts";
import type { SrsRating } from "../api/types.ts";

const RATING_LABEL: Record<SrsRating, string> = {
  again: "Errei",
  hard: "Difícil",
  good: "Bom",
  easy: "Fácil",
};

export function StudyItemPage() {
  const { id } = useParams();
  const itemId = Number(id);
  const { data: item, isLoading, error } = useStudyItem(itemId);
  const { data: history } = useReviewHistory(itemId);
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

      <header className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-slate-900/50 py-10">
        <span lang="zh-Hans" className="font-hanzi text-8xl text-slate-50">
          {item.entry.simplified}
        </span>
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
        <Fact label="Estado FSRS" value={item.card.state} />
        <Fact label="Próximo review" value={`${fromNow(item.card.due)} · ${formatDateTime(item.card.due)}`} />
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Trajetória
        </h2>
        {snapshots && snapshots.length > 0 ? (
          <ul className="divide-y divide-white/5">
            {snapshots.map((s, i) => {
              const lvl = levelOf(s.card);
              return (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-14 font-medium text-slate-200">
                    {RATING_LABEL[s.rating]}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: levelColor(lvl) }}
                  >
                    {levelLabel(lvl)}
                  </span>
                  <span className="text-slate-500">
                    {s.card.stability != null ? `${s.card.stability.toFixed(1)} d` : "—"}
                  </span>
                  <span className="ml-auto text-slate-500">
                    {formatDateTime(s.reviewed_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : history && history.length > 0 ? (
          <ul className="divide-y divide-white/5">
            {history.map((log, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-slate-200">{RATING_LABEL[log.rating]}</span>
                <span className="text-slate-500">{formatDateTime(log.review_datetime)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nenhum review ainda.</p>
        )}
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
