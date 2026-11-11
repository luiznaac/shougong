import { useCallback, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useStudyItemPages } from "../api/queries.ts";
import type { StudyItem } from "../api/types.ts";
import { DataList, type DataListColumn } from "../components/DataList.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { ItemBadges } from "../components/ItemBadges.tsx";
import { ItemFilters } from "../components/ItemFilters.tsx";
import { LoadMore } from "../components/LoadMore.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Pager } from "../components/Pager.tsx";
import { Panel } from "../components/Panel.tsx";
import { Pinyin } from "../components/Pinyin.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { SrsStageChip } from "../components/SrsStageChip.tsx";
import { srsStateLabel } from "../i18n/srsState.ts";
import { formatDate, fromNow } from "../lib/format.ts";
import {
  ITEM_PAGE_SIZE,
  type ItemIndexState,
  hasFilters,
  itemIndexQuery,
  itemIndexRequests,
  parseItemIndex,
  serializeItemIndex,
} from "../lib/itemIndex.ts";
import { PATHS, itemPath } from "../lib/navigation.ts";
import { pageCount, pageOffset } from "../lib/pagination.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";

const SKELETON_ROWS = [1, 2, 3, 4, 5, 6];

const secondaryButtonClass =
  "rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700";

const itemNoun = (count: number) => (count === 1 ? "item" : "itens");

const ITEM_COLUMNS: DataListColumn<StudyItem>[] = [
  {
    key: "word",
    label: "Palavra",
    render: (item) => <span className="font-hanzi text-lg">{item.entry.simplified}</span>,
  },
  { key: "pinyin", label: "Pinyin", render: (item) => <Pinyin value={item.entry.pinyin} /> },
  {
    key: "meaning",
    label: "Significado",
    render: (item) => item.entry.definitions[0] ?? "—",
  },
  { key: "stage", label: "Estágio", render: (item) => <SrsStageChip card={item.card} /> },
  {
    key: "state",
    label: "Estado",
    secondary: true,
    render: (item) => srsStateLabel(item.card.state),
  },
  {
    key: "hsk",
    label: "HSK",
    secondary: true,
    render: (item) => item.entry.hsk_level ?? "—",
  },
  {
    key: "due",
    label: "Vencimento",
    render: (item) => <span title={fromNow(item.card.due)}>{formatDate(item.card.due)}</span>,
  },
];

/**
 * Biblioteca's item index. Filters, sort, the desktop page and the mobile
 * "shown" count live in the URL, so a detail detour and the back button return
 * the learner to exactly the list position they left.
 */
export function ItemIndex() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const state = parseItemIndex(params);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const query = itemIndexQuery(state);
  const pages = useStudyItemPages(
    query,
    itemIndexRequests(state, isDesktop ? "desktop" : "mobile"),
  );
  const items = pages.flatMap((page) => page.data?.items ?? []);
  const total = pages[0]?.data?.total ?? 0;
  const error = pages.find((page) => page.error)?.error ?? null;
  const loading = pages.some((page) => page.isLoading);
  const loadingMore = loading && items.length > 0;

  // Patch the current URL rather than a captured state object, so a pending
  // debounced search cannot overwrite a filter chosen in the meantime.
  const update = useCallback(
    (patch: Partial<ItemIndexState>) => {
      setParams(
        (prev) => {
          const next = serializeItemIndex({ ...parseItemIndex(prev), ...patch });
          return next.toString() === prev.toString() ? prev : next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const narrow = useCallback(
    (patch: Partial<ItemIndexState>) => update({ page: 1, shown: ITEM_PAGE_SIZE, ...patch }),
    [update],
  );

  const [filtersReset, setFiltersReset] = useState(0);

  const clearFilters = () => {
    setFiltersReset((token) => token + 1);
    narrow({
      states: [],
      hskLevels: [],
      posTags: [],
      search: "",
      dueFrom: undefined,
      dueTo: undefined,
    });
  };

  const retry = () => {
    for (const page of pages) void page.refetch();
  };

  const lastPage = pageCount(total, ITEM_PAGE_SIZE);
  const listHref = `${location.pathname}${location.search}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Itens"
        summary={
          <div className="flex items-center gap-3 text-sm">
            {total > 0 ? (
              <span className="text-slate-400">
                {total} {itemNoun(total)}
              </span>
            ) : null}
            <Link to={PATHS.bibliotecaAdicionar} className="text-accent-500 hover:underline">
              Adicionar
            </Link>
            <Link to={PATHS.bibliotecaImportar} className="text-slate-400 hover:text-slate-200">
              Importar CSV
            </Link>
          </div>
        }
      />

      <ItemFilters
        state={state}
        onNarrow={narrow}
        onClear={clearFilters}
        resetToken={filtersReset}
      />

      <Panel title="Itens">
        {loading && items.length === 0 ? (
          <output className="block space-y-2">
            <span className="sr-only">Carregando itens…</span>
            {SKELETON_ROWS.map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </output>
        ) : error && items.length === 0 ? (
          <div role="alert" className="space-y-3 py-6 text-center">
            <p className="text-sm font-medium text-slate-200">
              Não foi possível carregar os itens.
            </p>
            <p className="text-sm text-slate-500">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <button type="button" onClick={retry} className={secondaryButtonClass}>
              Tentar novamente
            </button>
          </div>
        ) : items.length === 0 && total > 0 ? (
          <EmptyState
            icon="search"
            title="Esta página está além do fim da lista"
            description={`A lista tem ${total} ${itemNoun(total)}.`}
            action={
              <button
                type="button"
                onClick={() => update({ page: lastPage })}
                className={secondaryButtonClass}
              >
                Ir para a última página
              </button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nenhum item encontrado"
            description={
              hasFilters(state)
                ? "Nenhum item combina com estes filtros. Afrouxe um deles ou limpe a seleção."
                : "Adicione palavras ao estudo para vê-las aqui."
            }
            action={
              hasFilters(state) ? (
                <button type="button" onClick={clearFilters} className={secondaryButtonClass}>
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {error ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
              >
                <span>Não foi possível carregar mais itens.</span>
                <button type="button" onClick={retry} className="font-medium underline">
                  Tentar novamente
                </button>
              </div>
            ) : null}
            <DataList
              rows={items}
              columns={ITEM_COLUMNS}
              rowKey={(item) => item.id}
              rowHref={(item) => itemPath(item.id)}
              rowLinkState={{ from: listHref }}
              chips={(item) => <ItemBadges item={item} />}
              label="Itens de estudo"
            />
            {isDesktop ? (
              <Pager
                page={state.page}
                total={total}
                shown={Math.min(total, pageOffset(state.page, ITEM_PAGE_SIZE) + items.length)}
                pageSize={ITEM_PAGE_SIZE}
                onPageChange={(page) => update({ page })}
              />
            ) : (
              <LoadMore
                shown={Math.min(items.length, total)}
                total={total}
                loading={loadingMore}
                onLoadMore={() => update({ shown: state.shown + ITEM_PAGE_SIZE })}
              />
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
