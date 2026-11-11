// PROTOTYPE (wayfinder ticket #107) — "How should the Dashboard be laid out?"
// Three radically different dashboards on /prototype/dashboard, switchable via
// ?variant=A|B|C, with ?state=ready|loading|empty for the empty/loading passes.
// Throwaway: mocked data, no API, no tests.

import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import type { DashboardState } from "./dashboard/dashboardData.ts";
import { DossierDashboard } from "./dashboard/variants/DossierDashboard.tsx";
import { FocusDashboard } from "./dashboard/variants/FocusDashboard.tsx";
import { QueueDashboard } from "./dashboard/variants/QueueDashboard.tsx";

const VARIANTS = ["A", "B", "C"];
const LABELS: Record<string, string> = {
  A: "Fila de hoje",
  B: "Dossiê",
  C: "Fluxo focado",
};

const STATES: { key: DashboardState; label: string }[] = [
  { key: "ready", label: "Pronto" },
  { key: "loading", label: "Loading" },
  { key: "empty", label: "Vazio" },
];

export function DashboardPrototype() {
  const [params, setParams] = useSearchParams();
  const rawVariant = params.get("variant");
  const variant = rawVariant && VARIANTS.includes(rawVariant) ? rawVariant : "A";
  const rawState = params.get("state");
  const state: DashboardState = rawState === "loading" || rawState === "empty" ? rawState : "ready";

  const setState = (next: DashboardState) => {
    const p = new URLSearchParams(params);
    p.set("state", next);
    setParams(p, { replace: true });
  };

  return (
    <>
      <div className="fixed bottom-20 left-3 z-50 flex flex-col gap-2">
        <span className="w-fit rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200 backdrop-blur">
          PROTÓTIPO · #107 dashboard
        </span>
        <div className="flex w-fit overflow-hidden rounded-full border border-white/15 bg-slate-950/90 text-[10px] shadow-xl backdrop-blur">
          {STATES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setState(s.key)}
              className={`px-2.5 py-1 font-medium ${
                state === s.key ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {variant === "B" ? <DossierDashboard state={state} /> : null}
      {variant === "C" ? <FocusDashboard state={state} /> : null}
      {variant !== "B" && variant !== "C" ? <QueueDashboard state={state} /> : null}

      <PrototypeSwitcher variants={VARIANTS} labels={LABELS} />
    </>
  );
}
