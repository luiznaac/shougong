import { ListCount } from "./ListCount.tsx";

/**
 * The mobile list footer: an honest count and one full-width "Carregar mais"
 * button, which disappears once every row is shown. No infinite scroll.
 */
export function LoadMore({
  shown,
  total,
  loading = false,
  onLoadMore,
}: {
  shown: number;
  total: number;
  loading?: boolean;
  onLoadMore: () => void;
}) {
  const complete = shown >= total;

  return (
    <div className="space-y-3 pt-1">
      <ListCount shown={Math.min(shown, total)} total={total} />
      {complete ? null : (
        <button
          type="button"
          disabled={loading}
          onClick={onLoadMore}
          className="min-h-11 w-full rounded-lg bg-slate-800 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          Carregar mais
        </button>
      )}
    </div>
  );
}
