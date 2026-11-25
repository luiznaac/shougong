import { useEffect } from "react";
import { Icon } from "./icons.tsx";

// PROTOTYPE CHROME — not part of the design under evaluation. A floating
// bottom-centre bar that cycles a `?variant=` search param, plus arrow-key
// support. Rendered only in dev builds so a stray merge cannot ship it.

export interface PrototypeVariant {
  key: string;
  name: string;
}

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: PrototypeVariant[];
  current: string;
  onChange: (key: string) => void;
}) {
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );
  const active = variants[index];

  // Re-bound every render so the handler always sees the current variant.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      const next = variants[(index + step + variants.length) % variants.length];
      if (next) onChange(next.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!import.meta.env.DEV) return null;

  const cycle = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length];
    if (next) onChange(next.key);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-amber-400/40 bg-slate-950/95 px-2 py-1.5 shadow-2xl">
        <button
          type="button"
          aria-label="Variante anterior"
          onClick={() => cycle(-1)}
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <span className="min-w-44 text-center text-xs font-semibold text-slate-100">
          <span className="text-amber-300">{active?.key}</span>
          {active ? ` (${active.name})` : null}
        </span>
        <button
          type="button"
          aria-label="Próxima variante"
          onClick={() => cycle(1)}
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </div>
  );
}
