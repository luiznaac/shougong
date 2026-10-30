import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useLearningToReviewHistory, useStudyItems } from "../api/queries.ts";
import type { StudyItem } from "../api/types.ts";
import { ItemsLearnedChart } from "../components/ItemsLearnedChart.tsx";
import { ProgressTiles } from "../components/ProgressTiles.tsx";
import { SrsDistribution } from "../components/SrsDistribution.tsx";
import { UpcomingReviews } from "../components/UpcomingReviews.tsx";
import { type CharacterFilter, orderCharacterTiles } from "../lib/characterPanel.ts";
import { tallyGroups } from "../lib/srs.ts";

export function Dashboard() {
  const [filter, setFilter] = useState<CharacterFilter>("all");
  const { data: items, isLoading, error } = useStudyItems();
  const { data: dueItems } = useStudyItems({ due: true });
  // Fetched eagerly so the leech chip count is accurate on dashboard load.
  const {
    data: leechItems,
    isLoading: leechesLoading,
    error: leechesError,
  } = useStudyItems({ leech: true });
  const { data: learnedHistory } = useLearningToReviewHistory();

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (error) return <p className="text-rose-400">Falha ao carregar: {String(error)}</p>;
  if (!items) return null;

  // Left button → lesson flow: everything still in `learning`.
  const lessonCount = items.filter((i) => i.card.state === "learning").length;
  // Right button → review flow: `due=true` comes straight from the backend
  // (it owns the day-boundary logic); keep only the `review`-state ones —
  // learning items are handled by the lesson flow.
  const reviewCount = (dueItems ?? []).filter((i) => i.card.state === "review").length;
  const tally = tallyGroups(items.map((i) => i.card));
  const tiles = orderCharacterTiles(filter, { all: items, leeches: leechItems ?? [] });

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
        <Panel title="Itens aprendidos">
          <ItemsLearnedChart history={learnedHistory ?? []} />
        </Panel>
      </div>

      <Panel
        title="Caracteres"
        action={
          <CharacterFilterChips
            filter={filter}
            onChange={setFilter}
            allCount={items.length}
            leechCount={leechItems?.length ?? 0}
          />
        }
      >
        <CharacterPanelBody
          filter={filter}
          tiles={tiles}
          allCount={items.length}
          leechesLoading={leechesLoading}
          leechesError={leechesError}
        />
      </Panel>
    </div>
  );
}

function CharacterPanelBody({
  filter,
  tiles,
  allCount,
  leechesLoading,
  leechesError,
}: {
  filter: CharacterFilter;
  tiles: StudyItem[];
  allCount: number;
  leechesLoading: boolean;
  leechesError: Error | null;
}) {
  if (filter === "leeches") {
    if (leechesLoading) return <p className="text-sm text-slate-400">Carregando sanguessugas…</p>;
    if (leechesError) {
      return <p className="text-sm text-rose-400">Falha ao carregar: {String(leechesError)}</p>;
    }
    if (tiles.length === 0) {
      return <p className="text-sm text-slate-500">Nenhum sanguessuga no momento.</p>;
    }
    return <ProgressTiles items={tiles} />;
  }
  if (allCount === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nada ainda.{" "}
        <Link to="/add" className="text-accent-500 hover:underline">
          Adicione itens
        </Link>
        .
      </p>
    );
  }
  return <ProgressTiles items={tiles} />;
}

function CharacterFilterChips({
  filter,
  onChange,
  allCount,
  leechCount,
}: {
  filter: CharacterFilter;
  onChange: (filter: CharacterFilter) => void;
  allCount: number;
  leechCount: number;
}) {
  return (
    <fieldset className="flex min-w-0 gap-1 border-0 p-0">
      <legend className="sr-only">Filtrar caracteres</legend>
      <FilterChip pressed={filter === "all"} onClick={() => onChange("all")}>
        Todas ({allCount})
      </FilterChip>
      <FilterChip pressed={filter === "leeches"} onClick={() => onChange("leeches")}>
        Sanguessugas ({leechCount})
      </FilterChip>
    </fieldset>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        pressed
          ? "border-accent-500 bg-accent-500/15 text-accent-300"
          : "border-white/10 text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
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

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
