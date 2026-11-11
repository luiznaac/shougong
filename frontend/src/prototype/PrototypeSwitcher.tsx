// Throwaway prototype switcher (wayfinder ticket #105). Floating, high-contrast
// pill that cycles `?variant=`; hidden from production builds.

import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "./icons.tsx";

export function PrototypeSwitcher({
  variants,
  labels,
}: {
  variants: string[];
  labels: Record<string, string>;
}) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("variant");
  const current = raw && variants.includes(raw) ? raw : variants[0];

  const cycle = useCallback(
    (dir: number) => {
      const i = variants.indexOf(current);
      const next = variants[(i + dir + variants.length) % variants.length];
      const p = new URLSearchParams(params);
      p.set("variant", next);
      setParams(p, { replace: true });
    },
    [current, params, setParams, variants],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      cycle(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-slate-950/90 py-1.5 pr-1.5 pl-1.5 text-slate-100 shadow-2xl ring-1 ring-black/40 backdrop-blur">
      <button
        type="button"
        onClick={() => cycle(-1)}
        aria-label="Variante anterior"
        className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <Icon name="chevron-left" className="h-4 w-4" />
      </button>
      <span className="min-w-40 px-2 text-center text-xs font-medium tracking-wide">
        <span className="text-accent-500">{current}</span>
        <span className="text-slate-500"> · </span>
        {labels[current]}
      </span>
      <button
        type="button"
        onClick={() => cycle(1)}
        aria-label="Próxima variante"
        className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <Icon name="chevron-right" className="h-4 w-4" />
      </button>
    </div>
  );
}
