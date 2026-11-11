import type { ReactNode } from "react";

/**
 * The one page title block: an optional eyebrow (date or section), the title and
 * an optional right-side summary chip. Every paged surface uses it so the
 * heading size and spacing never drift between surfaces.
 */
export function PageHeader({
  eyebrow,
  title,
  summary,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
      </div>
      {summary ? <div className="shrink-0">{summary}</div> : null}
    </header>
  );
}
