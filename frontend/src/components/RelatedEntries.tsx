import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useAddStudyItem, useRelatedEntries, useRelatedEntryPages } from "../api/queries.ts";
import type { RelatedEntry } from "../api/types.ts";
import { itemPath } from "../lib/navigation.ts";
import { pageOffset } from "../lib/pagination.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";
import { EmptyState } from "./EmptyState.tsx";
import { Hanzi } from "./Hanzi.tsx";
import { HskChip } from "./HskChip.tsx";
import { LoadMore } from "./LoadMore.tsx";
import { Pager } from "./Pager.tsx";
import { Pinyin } from "./Pinyin.tsx";
import { PanelState } from "./QueryState.tsx";

const RELATED_PAGE_SIZE = 8;

/**
 * Related words from the shared-character route. The server's order is rendered
 * as received — two-up paged grid on desktop at eight per page, one growing
 * list with "Carregar mais" on mobile. A queued word links to its study item;
 * an unqueued one can be added inline.
 */
export function RelatedEntries({
  entryId,
  layout,
}: {
  entryId: number;
  layout: Presentation;
}) {
  return layout === "desktop" ? (
    <DesktopRelated entryId={entryId} />
  ) : (
    <MobileRelated entryId={entryId} />
  );
}

function DesktopRelated({ entryId }: { entryId: number }) {
  const [page, setPage] = useState(1);
  const related = useRelatedEntries(
    entryId,
    RELATED_PAGE_SIZE,
    pageOffset(page, RELATED_PAGE_SIZE),
  );
  const add = useAddStudyItem();
  const items = related.data?.items ?? [];
  const total = related.data?.total ?? 0;

  return (
    <RelatedBody
      layout="desktop"
      items={items}
      isLoading={related.isLoading}
      error={related.error}
      onRetry={() => void related.refetch()}
      onAdd={(entry) => add.mutate(entry.id)}
      adding={add.isPending}
      footer={
        <Pager
          page={page}
          total={total}
          shown={Math.min(total, pageOffset(page, RELATED_PAGE_SIZE) + items.length)}
          pageSize={RELATED_PAGE_SIZE}
          onPageChange={setPage}
        />
      }
    />
  );
}

function MobileRelated({ entryId }: { entryId: number }) {
  const related = useRelatedEntryPages(entryId, RELATED_PAGE_SIZE);
  const add = useAddStudyItem();
  const items = related.data?.pages.flatMap((page) => page.items) ?? [];
  const total = related.data?.pages.at(-1)?.total ?? 0;

  return (
    <RelatedBody
      layout="mobile"
      items={items}
      isLoading={related.isLoading}
      error={related.error}
      onRetry={() => void related.refetch()}
      onAdd={(entry) => add.mutate(entry.id)}
      adding={add.isPending}
      footer={
        <LoadMore
          shown={items.length}
          total={total}
          loading={related.isFetchingNextPage}
          onLoadMore={() => void related.fetchNextPage()}
        />
      }
    />
  );
}

function RelatedBody({
  layout,
  items,
  isLoading,
  error,
  onRetry,
  onAdd,
  adding,
  footer,
}: {
  layout: Presentation;
  items: RelatedEntry[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onAdd: (entry: RelatedEntry) => void;
  adding: boolean;
  footer: ReactNode;
}) {
  return (
    <PanelState
      isLoading={isLoading}
      loadingLabel="Carregando palavras relacionadas…"
      error={error}
      errorTitle="Não foi possível carregar as palavras relacionadas."
      onRetry={onRetry}
    >
      {items.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhuma palavra relacionada"
          description="Nenhuma outra palavra do dicionário compartilha um caractere com esta."
        />
      ) : (
        <div className="space-y-3">
          <ul
            aria-label="Palavras relacionadas"
            className={`grid gap-x-6 ${layout === "desktop" ? "sm:grid-cols-2" : "grid-cols-1"}`}
          >
            {items.map((entry) => (
              <li key={entry.id} className="border-b border-white/5">
                <RelatedRow entry={entry} onAdd={() => onAdd(entry)} adding={adding} />
              </li>
            ))}
          </ul>
          {footer}
        </div>
      )}
    </PanelState>
  );
}

function RelatedRow({
  entry,
  onAdd,
  adding,
}: {
  entry: RelatedEntry;
  onAdd: () => void;
  adding: boolean;
}) {
  const body = (
    <>
      <Hanzi
        text={entry.simplified}
        singleCharPx={24}
        boxPx={72}
        className="shrink-0 text-slate-100"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Pinyin value={entry.pinyin} className="text-xs text-slate-400" />
          <HskChip level={entry.hsk_level} />
        </div>
        <p className="truncate text-[11px] text-slate-400">{entry.definitions.join("; ")}</p>
      </div>
    </>
  );

  if (entry.study_item_id != null) {
    return (
      <Link
        to={itemPath(entry.study_item_id)}
        className="flex items-center gap-3 py-2.5 transition-colors hover:bg-white/5"
      >
        {body}
        <span className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-400">
          na fila
        </span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      {body}
      <button
        type="button"
        aria-label={`Adicionar ${entry.simplified}`}
        onClick={onAdd}
        disabled={adding}
        className="shrink-0 rounded-md bg-accent-500 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
      >
        Adicionar
      </button>
    </div>
  );
}
