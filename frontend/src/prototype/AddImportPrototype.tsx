// Throwaway prototype route (wayfinder ticket #108 — Add items and Batch import).
// Three variants of the add/import workflow, switchable via `?variant=` on the
// existing /add surface. Mocked data, no API calls; the switcher is dev-only.

import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { CommandLibraryAddImport } from "./addimport/variants/CommandLibraryAddImport.tsx";
import { SideBySideAddImport } from "./addimport/variants/SideBySideAddImport.tsx";
import { StepperAddImport } from "./addimport/variants/StepperAddImport.tsx";

const VARIANTS = ["A", "B", "C"];

const LABELS: Record<string, string> = {
  A: "Lado a lado",
  B: "Fluxo em etapas",
  C: "Biblioteca com busca",
};

export function AddImportPrototype() {
  const [params] = useSearchParams();
  const raw = params.get("variant");
  const variant = raw && VARIANTS.includes(raw) ? raw : "A";

  return (
    <>
      {variant === "A" && <SideBySideAddImport />}
      {variant === "B" && <StepperAddImport />}
      {variant === "C" && <CommandLibraryAddImport />}
      <PrototypeSwitcher variants={VARIANTS} labels={LABELS} />
    </>
  );
}
