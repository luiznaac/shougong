import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton.tsx";

/**
 * The per-panel loading/error gate: while loading it renders skeleton rows, on
 * failure the error block with retry, and otherwise the panel's own content
 * (which owns its empty state). Every query-fed panel shares this shape.
 */
export function PanelState({
  isLoading,
  loadingLabel,
  loadingRows = 3,
  skeletonClass = "h-12 w-full",
  error,
  errorTitle,
  onRetry,
  children,
}: {
  isLoading: boolean;
  loadingLabel: string;
  loadingRows?: number;
  skeletonClass?: string;
  error: unknown;
  errorTitle: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return <PanelLoading label={loadingLabel} rows={loadingRows} skeletonClass={skeletonClass} />;
  }
  if (error) {
    return <PanelError title={errorTitle} error={error} onRetry={onRetry} />;
  }
  return <>{children}</>;
}

/**
 * The per-panel loading block: a screen-reader label plus decorative skeleton
 * rows. Every panel owns its own loading state; the caller picks the row shape.
 */
export function PanelLoading({
  label,
  rows = 3,
  skeletonClass = "h-12 w-full",
}: {
  label: string;
  rows?: number;
  skeletonClass?: string;
}) {
  const slots = Array.from({ length: rows }, (_, index) => `skeleton-${index}`);
  return (
    <output className="block space-y-2">
      <span className="sr-only">{label}</span>
      {slots.map((slot) => (
        <Skeleton key={slot} className={skeletonClass} />
      ))}
    </output>
  );
}

/** The per-panel failure block: a plain-language title, the error detail and retry. */
export function PanelError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="space-y-3 py-6 text-center">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="text-sm text-slate-500">
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
