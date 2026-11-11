import { pageCount, pageWindow } from "../lib/pagination.ts";
import { ListCount } from "./ListCount.tsx";

const buttonClass =
  "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/**
 * The desktop pager: numbered pages with previous/next, disabled at the ends.
 * It renders the server's page order as received and never re-sorts. `shown` is
 * derived from the rows actually received, so the caption never overstates.
 */
export function Pager({
  page,
  total,
  shown,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  shown: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const pages = pageCount(total, pageSize);
  const previous = page <= 1;
  const next = page >= pages;

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3">
      <ListCount shown={shown} total={total} />
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={previous}
          onClick={() => onPageChange(page - 1)}
          className={`${buttonClass} text-slate-400 hover:bg-white/5 hover:text-slate-200`}
        >
          ‹
        </button>
        {pageWindow(page, pages).map((number, index) =>
          number === null ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: ellipsis placeholders have no identity
            <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-slate-600">
              …
            </span>
          ) : (
            <button
              key={number}
              type="button"
              aria-label={`Página ${number}`}
              aria-current={number === page ? "page" : undefined}
              onClick={() => onPageChange(number)}
              className={`${buttonClass} ${
                number === page
                  ? "bg-accent-500 font-semibold text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {number}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Próxima página"
          disabled={next}
          onClick={() => onPageChange(page + 1)}
          className={`${buttonClass} text-slate-400 hover:bg-white/5 hover:text-slate-200`}
        >
          ›
        </button>
      </div>
    </nav>
  );
}
