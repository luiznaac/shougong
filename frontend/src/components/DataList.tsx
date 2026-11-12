import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface DataListColumn<T> {
  key: string;
  label: string;
  /** Dropped from the stacked mobile card; the primary columns stay. */
  secondary?: boolean;
  render: (row: T) => ReactNode;
}

/**
 * The shared list presentation: one dense desktop table and one stacked mobile
 * card list, both rendered from the same rows and the same column model. The
 * server's row order is rendered as received — the list never re-sorts.
 *
 * Every row links to its detail target from both presentations when `rowHref`
 * is given, so the two widths cannot drift into different destinations. A list
 * with interactive row content (enqueue buttons, candidate pickers) omits
 * `rowHref` and renders plain rows instead of a full-row link.
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  rowLinkState,
  chips,
  label = "Itens",
}: {
  rows: T[];
  columns: DataListColumn<T>[];
  rowKey: (row: T) => string | number;
  rowHref?: (row: T) => string;
  rowLinkState?: unknown;
  chips?: (row: T) => ReactNode;
  label?: string;
}) {
  const [primary, ...rest] = columns;
  const cardColumns = rest.filter((column) => !column.secondary);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-3 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const chipSlot = chips ? (
                <span className="ml-2 inline-flex items-center gap-1 align-middle">
                  {chips(row)}
                </span>
              ) : null;
              return (
                <tr
                  key={rowKey(row)}
                  className="relative border-b border-white/5 transition-colors last:border-0 hover:bg-white/5"
                >
                  {columns.map((column, index) => (
                    <td key={column.key} className="px-3 py-3 align-middle text-slate-300">
                      {index === 0 ? (
                        rowHref ? (
                          <>
                            <Link
                              to={rowHref(row)}
                              state={rowLinkState}
                              className="font-medium text-slate-100 after:absolute after:inset-0 after:content-['']"
                            >
                              {column.render(row)}
                            </Link>
                            {chipSlot}
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-slate-100">{column.render(row)}</span>
                            {chipSlot}
                          </>
                        )
                      ) : (
                        column.render(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul aria-label={label} className="space-y-2 md:hidden">
        {rows.map((row) => {
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-medium text-slate-100">{primary.render(row)}</span>
                {chips ? (
                  <span className="inline-flex items-center gap-1">{chips(row)}</span>
                ) : null}
              </div>
              <dl className="mt-1 space-y-0.5">
                {cardColumns.map((column) => (
                  <div key={column.key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">
                      {column.label}
                    </dt>
                    <dd className="min-w-0 text-right text-sm text-slate-300">
                      {column.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link
                  to={rowHref(row)}
                  state={rowLinkState}
                  className="block rounded-xl bg-slate-900/60 p-4 ring-1 ring-white/10 transition-colors hover:bg-slate-800"
                >
                  {body}
                </Link>
              ) : (
                <div className="block rounded-xl bg-slate-900/60 p-4 ring-1 ring-white/10">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
