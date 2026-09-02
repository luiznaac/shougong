import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useStudyItems } from "../api/queries.ts";
import { isDue } from "../lib/format.ts";
import { tallyStages } from "../lib/srs.ts";
import { SrsStageBar } from "../components/SrsStageBar.tsx";
import { ReviewForecast } from "../components/ReviewForecast.tsx";
import { Pinyin } from "../components/Pinyin.tsx";

export function Dashboard() {
  const { data: items, isLoading, error } = useStudyItems();

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (error) return <p className="text-rose-400">Falha ao carregar: {String(error)}</p>;
  if (!items) return null;

  const dueCount = items.filter((i) => isDue(i.card.due)).length;
  const newCount = items.filter((i) => i.card.state === "learning" && !i.card.last_review).length;
  const tally = tallyStages(items.map((i) => i.card));

  const upNext = [...items]
    .filter((i) => !isDue(i.card.due))
    .sort((a, b) => a.card.due.localeCompare(b.card.due))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Reviews agora" value={dueCount} accent />
        <Stat label="Itens novos" value={newCount} />
        <Stat label="Total em estudo" value={items.length} />
      </section>

      <Link
        to="/review"
        className={`block rounded-xl px-6 py-5 text-center text-lg font-semibold transition-colors ${
          dueCount > 0
            ? "bg-accent-500 text-white hover:bg-accent-600"
            : "pointer-events-none bg-slate-800 text-slate-500"
        }`}
      >
        {dueCount > 0 ? `Começar review (${dueCount})` : "Nada para revisar agora"}
      </Link>

      <Panel title="Progressão SRS">
        <SrsStageBar tally={tally} />
      </Panel>

      <Panel title="Forecast de reviews">
        <ReviewForecast items={items} />
      </Panel>

      <Panel title="Próximos itens">
        {upNext.length === 0 ? (
          <p className="text-sm text-slate-500">Sem itens agendados.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {upNext.map((i) => (
              <li key={i.id}>
                <Link
                  to={`/items/${i.id}`}
                  className="flex items-center gap-4 py-2.5 hover:bg-white/5"
                >
                  <span lang="zh-Hans" className="font-hanzi text-2xl text-slate-100">
                    {i.entry.simplified}
                  </span>
                  <Pinyin value={i.entry.pinyin} className="text-sm" />
                  <span className="truncate text-sm text-slate-400">
                    {i.entry.definitions[0]}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-slate-500">
                    {new Date(i.card.due).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 px-5 py-4">
      <div
        className={`text-3xl font-bold tabular-nums ${accent ? "text-accent-500" : "text-slate-100"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}
