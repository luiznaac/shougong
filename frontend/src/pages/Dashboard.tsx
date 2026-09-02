import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useStudyItems } from "../api/queries.ts";
import { isDue } from "../lib/format.ts";
import { tallyGroups } from "../lib/srs.ts";
import { SrsDistribution } from "../components/SrsDistribution.tsx";
import { UpcomingReviews } from "../components/UpcomingReviews.tsx";
import { ItemsAddedChart } from "../components/ItemsAddedChart.tsx";
import { ProgressTiles } from "../components/ProgressTiles.tsx";

export function Dashboard() {
  const { data: items, isLoading, error } = useStudyItems();

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (error) return <p className="text-rose-400">Falha ao carregar: {String(error)}</p>;
  if (!items) return null;

  // Left button → lesson flow: everything still in `learning`.
  const lessonCount = items.filter((i) => i.card.state === "learning").length;
  // Right button → review flow: only `review`-state items that are due (learning
  // items are handled by the lesson flow, not counted here).
  const reviewCount = items.filter(
    (i) => i.card.state === "review" && isDue(i.card.due),
  ).length;
  const tally = tallyGroups(items.map((i) => i.card));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <BigButton
          to="/lesson"
          count={lessonCount}
          label="Lições"
          className="from-cyan-400 to-blue-600"
          disabled={lessonCount === 0}
        />
        <BigButton
          to="/review"
          count={reviewCount}
          label="Reviews"
          className="from-rose-400 to-accent-600"
          disabled={reviewCount === 0}
        />
      </section>

      <Panel title="SRS Stage Distribution">
        <SrsDistribution tally={tally} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming Reviews">
          <UpcomingReviews items={items} />
        </Panel>
        <Panel title="Itens adicionados">
          <ItemsAddedChart items={items} />
        </Panel>
      </div>

      <Panel title={`Caracteres (${items.length})`}>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nada ainda. <Link to="/add" className="text-accent-500 hover:underline">Adicione itens</Link>.
          </p>
        ) : (
          <ProgressTiles items={items} />
        )}
      </Panel>
    </div>
  );
}

function BigButton({
  to,
  count,
  label,
  className,
  disabled,
}: {
  to: string;
  count: number;
  label: string;
  className: string;
  disabled?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`relative flex h-28 flex-col items-center justify-center rounded-lg bg-gradient-to-b text-white shadow transition-transform hover:-translate-y-0.5 ${className} ${
        disabled ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <span className="text-5xl font-semibold tabular-nums">{count}</span>
      <span className="mt-1 text-lg font-medium">{label}</span>
    </Link>
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
