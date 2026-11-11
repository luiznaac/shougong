// Throwaway prototype (wayfinder ticket #111 — Lesson, Review and Practice).
// Three variants of the full-screen runner on /prototype/practice, switchable
// via `?variant=`, plus `?mode=` for lição/review/prática. Each renders a
// desktop stage and a 390px mobile frame sharing one in-memory session. Mocked
// data, no API calls; both switchers are dev-only.

import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { MODES, type PracticeMode } from "./practice/practiceData.ts";
import { BenchPractice } from "./practice/variants/BenchPractice.tsx";
import { CardPractice } from "./practice/variants/CardPractice.tsx";
import { StagePractice } from "./practice/variants/StagePractice.tsx";

const VARIANTS = ["A", "B", "C"];
const LABELS: Record<string, string> = {
  A: "Palco (bandas + dock)",
  B: "Bancada (painel lateral)",
  C: "Cartão (tela bounded)",
};
const MODE_KEYS: PracticeMode[] = ["lesson", "review", "practice"];

function isMode(value: string | null): value is PracticeMode {
  return value != null && MODE_KEYS.includes(value as PracticeMode);
}

export function PracticePrototype() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("variant");
  const variant = raw && VARIANTS.includes(raw) ? raw : "A";
  const modeParam = params.get("mode");
  const mode: PracticeMode = isMode(modeParam) ? modeParam : "review";

  const setMode = (next: PracticeMode) => {
    const p = new URLSearchParams(params);
    p.set("mode", next);
    setParams(p, { replace: true });
  };

  return (
    <>
      {variant === "A" && <StagePractice key={mode} mode={mode} />}
      {variant === "B" && <BenchPractice key={mode} mode={mode} />}
      {variant === "C" && <CardPractice key={mode} mode={mode} />}
      <PrototypeSwitcher variants={VARIANTS} labels={LABELS} />
      <div className="fixed right-5 bottom-5 z-50 flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/90 p-1.5 text-[11px] shadow-2xl backdrop-blur">
        <span className="px-1.5 text-[10px] tracking-wide text-slate-500 uppercase">Modo</span>
        {MODE_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-full px-2.5 py-1 font-medium transition ${
              key === mode ? "bg-white/15 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {MODES[key].eyebrow}
          </button>
        ))}
      </div>
    </>
  );
}
