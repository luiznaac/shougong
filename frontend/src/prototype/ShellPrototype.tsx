// PROTOTYPE (wayfinder ticket #105) — "Which app shell should the redesign adopt?"
// Three radically different shells, switchable via ?variant=A|B|C on
// /prototype/shell. Throwaway: mocked data, no API, no tests.

import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { CommandBarShell } from "./variants/CommandBarShell.tsx";
import { PaperPaletteShell } from "./variants/PaperPaletteShell.tsx";
import { RailHeroShell } from "./variants/RailHeroShell.tsx";

const VARIANTS = ["A", "B", "C"];
const LABELS: Record<string, string> = {
  A: "Command bar",
  B: "Rail + hero",
  C: "Paper + palette",
};

export function ShellPrototype() {
  const [params] = useSearchParams();
  const variant = params.get("variant") ?? "A";

  return (
    <>
      <div className="fixed bottom-3 left-3 z-50 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-200 backdrop-blur">
        PROTÓTIPO · #105 app shell
      </div>
      {variant === "B" ? <RailHeroShell /> : null}
      {variant === "C" ? <PaperPaletteShell /> : null}
      {variant !== "B" && variant !== "C" ? <CommandBarShell /> : null}
      <PrototypeSwitcher variants={VARIANTS} labels={LABELS} />
    </>
  );
}
