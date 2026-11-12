import type { ReactNode } from "react";

/**
 * The one bounded surface: a rounded panel with a hairline ring, an optional
 * uppercase section label and a right-side action slot. Content never stretches
 * the page — panels carry their own limit.
 */
export function Panel({
  title,
  action,
  ariaLabel,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`rounded-2xl bg-slate-900/50 p-5 ring-1 ring-white/10 ${className}`}
    >
      {title || action ? (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
