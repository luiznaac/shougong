import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useStudyItemPages, useStudyOverview } from "../api/queries.ts";
import type { StudyItem, StudyOverview } from "../api/types.ts";
import { CHARACTER_GRID_CLASS, CharacterTileGrid } from "../components/CharacterTileGrid.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { ExtraStudyPanel } from "../components/ExtraStudyPanel.tsx";
import { ItemsLearnedChart } from "../components/ItemsLearnedChart.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Panel } from "../components/Panel.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { SrsHalfPie } from "../components/SrsHalfPie.tsx";
import { UpcomingReviews } from "../components/UpcomingReviews.tsx";
import { Icon } from "../components/icons.tsx";

type CharacterFilter = "all" | "leeches";

const PAGE_SIZE = 12;
const GRID_SKELETON_KEYS = Array.from({ length: PAGE_SIZE }, (_, i) => `grid-skeleton-${i}`);

/**
 * Hoje: today's queue leads the main column, then the character grid, the learned
 * chart and Extra Study; a sticky rail carries the SRS half-pie and the seven-day
 * forecast. Every aggregate comes from the one overview request, and the grid
 * reads one page of twelve at a time — the page never pages through the queue.
 */
export function Dashboard() {
  const [filter, setFilter] = useState<CharacterFilter>("all");
  const [today] = useState(() => new Date());
  const overview = useStudyOverview();
  const grid = useStudyItemPages(
    filter === "leeches" ? { leech: true } : { sort: "stability_asc" },
    PAGE_SIZE,
  );

  const items = grid.data?.pages.flatMap((page) => page.items) ?? [];
  const total = grid.data?.pages.at(-1)?.total ?? 0;
  const moreAvailable = items.length < total;
  const data = overview.data;
  const forecastTotal = data?.next_seven_days.reduce((n, day) => n + day.due, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={today.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
        title="Hoje"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <TodayQueue data={data} isLoading={overview.isLoading} error={overview.error} />

          <Panel
            title="Caracteres"
            action={
              <CharacterFilterChips
                filter={filter}
                onChange={setFilter}
                allCount={data?.item_count ?? 0}
                leechCount={data?.leech_count ?? 0}
              />
            }
          >
            <CharacterGridBody
              filter={filter}
              items={items}
              total={total}
              isLoading={grid.isLoading}
              error={grid.error}
              onLoadMore={moreAvailable ? () => grid.fetchNextPage() : undefined}
            />
          </Panel>

          <Panel title="Itens aprendidos">
            <OverviewBody
              isLoading={overview.isLoading}
              error={overview.error}
              data={data}
              what="os itens aprendidos"
              skeleton="h-44 w-full"
            >
              {(learned) => <ItemsLearnedChart learned={learned.learned} />}
            </OverviewBody>
          </Panel>

          <Panel title="Estudo extra">
            <ExtraStudyPanel />
          </Panel>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Panel
            title="SRS Stages"
            action={<Icon name="layers" size={16} className="text-slate-600" />}
          >
            <OverviewBody
              isLoading={overview.isLoading}
              error={overview.error}
              data={data}
              what="a distribuição SRS"
              skeleton="h-32 w-full"
            >
              {(stats) => <SrsHalfPie tally={stats.srs_distribution} />}
            </OverviewBody>
          </Panel>

          <Panel
            title="Próximas revisões"
            action={
              data ? (
                <span className="text-[10px] text-slate-500">{forecastTotal} em 7 dias</span>
              ) : null
            }
          >
            <OverviewBody
              isLoading={overview.isLoading}
              error={overview.error}
              data={data}
              what="as próximas revisões"
              skeleton="h-24 w-full"
            >
              {(stats) => <UpcomingReviews days={stats.next_seven_days} />}
            </OverviewBody>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function OverviewBody({
  isLoading,
  error,
  data,
  what,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error: Error | null;
  data: StudyOverview | undefined;
  what: string;
  skeleton: string;
  children: (data: StudyOverview) => ReactNode;
}) {
  if (isLoading) return <Skeleton className={skeleton} />;
  if (error) return <PanelError what={what} error={error} />;
  if (!data) return null;
  return <>{children(data)}</>;
}

function TodayQueue({
  data,
  isLoading,
  error,
}: {
  data: StudyOverview | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const due = data?.due_review_count ?? 0;
  const lessons = data?.new_count ?? 0;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 p-6 ring-1 ring-white/10">
      <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-accent-500/10 blur-3xl" />
      <p className="text-sm text-slate-400">Sua fila de hoje</p>
      {isLoading ? (
        <div className="mt-4 space-y-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-11 w-72" />
        </div>
      ) : error ? (
        <PanelError what="a fila de hoje" error={error} />
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-5xl font-semibold tabular-nums text-white">{due}</span>
            <span className="text-sm text-slate-400">reviews</span>
            <span className="text-3xl font-semibold tabular-nums text-slate-300">{lessons}</span>
            <span className="text-sm text-slate-400">lições novas</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <HeroAction to="/review" disabled={due === 0} primary>
              Começar reviews <Icon name="arrow-right" size={16} />
            </HeroAction>
            <HeroAction to="/lesson" disabled={lessons === 0}>
              Aprender {lessons} novas
            </HeroAction>
          </div>
          {data && data.item_count === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              Nada ainda — adicione seus primeiros itens na Biblioteca.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function HeroAction({
  to,
  disabled,
  primary = false,
  children,
}: {
  to: string;
  disabled: boolean;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
      className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold ${
        primary
          ? "bg-gradient-to-r from-rose-500 to-accent-600 text-white shadow-lg"
          : "bg-slate-800 text-slate-100 ring-1 ring-white/10"
      } ${disabled ? "pointer-events-none opacity-40" : ""}`}
    >
      {children}
    </Link>
  );
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

function CharacterGridBody({
  filter,
  items,
  total,
  isLoading,
  error,
  onLoadMore,
}: {
  filter: CharacterFilter;
  items: StudyItem[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  onLoadMore: (() => void) | undefined;
}) {
  if (isLoading) {
    return (
      <div className={CHARACTER_GRID_CLASS}>
        {GRID_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="aspect-square w-full" />
        ))}
      </div>
    );
  }
  if (error) return <PanelError what="os caracteres" error={error} />;
  if (filter === "leeches" && total === 0) {
    return <p className="text-sm text-slate-500">Nenhum sanguessuga no momento.</p>;
  }
  if (total === 0) {
    return (
      <EmptyState
        icon="book"
        title="Nenhum caractere ainda"
        description="Adicione seus primeiros itens para vê-los aqui."
        action={
          <Link
            to="/biblioteca/adicionar"
            className="mt-1 rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Adicionar itens
          </Link>
        }
      />
    );
  }

  return (
    <>
      <CharacterTileGrid items={items} onLoadMore={onLoadMore} />
      <p className="mt-3 text-xs text-slate-500">
        Mostrando {items.length} de {total}
      </p>
    </>
  );
}

function PanelError({ what, error }: { what: string; error: Error }) {
  return (
    <p className="text-sm text-rose-400">
      Falha ao carregar {what}: {error.message}
    </p>
  );
}
