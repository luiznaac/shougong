import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "../../../components/PrototypeSwitcher.tsx";
import { VariantA } from "./VariantA.tsx";
import { VariantB } from "./VariantB.tsx";
import { VariantC } from "./VariantC.tsx";
import { SCENARIOS, type SyncScenario } from "./fakeSync.ts";

// PROTOTYPE — three variants of the HanziHero sync panel on the existing
// /ajustes route, switchable via ?variant=, with a ?scenario= state selector so
// every layout can be judged across the whole connect → sync → result flow.
// In-memory only: no API call, no persistence. See issue #197.

const VARIANTS = [
  { key: "A", name: "Passo a passo" },
  { key: "B", name: "Conta + atividade" },
  { key: "C", name: "Mesa de trabalho" },
] as const;

const DEFAULT_SCENARIO: SyncScenario = "resultado";

function isScenario(value: string | null): value is SyncScenario {
  return SCENARIOS.some((scenario) => scenario.key === value);
}

export function HanziHeroSyncPrototype() {
  const [params, setParams] = useSearchParams();
  const variantParam = params.get("variant");
  const variant = VARIANTS.find((item) => item.key === variantParam)?.key ?? "A";
  const scenarioParam = params.get("scenario");
  const scenario = isScenario(scenarioParam) ? scenarioParam : DEFAULT_SCENARIO;

  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const setParam = (key: string, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const chooseScenario = (next: SyncScenario) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setParam("scenario", next);
  };

  const onSync = () => {
    chooseScenario("sincronizando");
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setParam("scenario", "resultado");
    }, 1800);
  };

  if (!import.meta.env.DEV) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-amber-400/30 bg-amber-400/5 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">
            Protótipo · estado
          </span>
          {SCENARIOS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => chooseScenario(item.key)}
              aria-pressed={scenario === item.key}
              className={[
                "rounded-full px-2 py-0.5 text-[11px] transition-colors",
                scenario === item.key
                  ? "bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/40"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {variant === "A" ? (
        <VariantA
          scenario={scenario}
          onConnect={() => chooseScenario("conectado")}
          onSync={onSync}
          onReconnect={() => chooseScenario("desconectado")}
        />
      ) : variant === "B" ? (
        <VariantB
          scenario={scenario}
          onConnect={() => chooseScenario("conectado")}
          onSync={onSync}
          onReconnect={() => chooseScenario("desconectado")}
        />
      ) : (
        <VariantC
          scenario={scenario}
          onConnect={() => chooseScenario("conectado")}
          onSync={onSync}
          onReconnect={() => chooseScenario("desconectado")}
        />
      )}

      <PrototypeSwitcher
        variants={VARIANTS.map((item) => ({ ...item }))}
        current={variant}
        onChange={(key) => setParam("variant", key)}
      />
    </div>
  );
}
