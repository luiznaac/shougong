// Throwaway prototype (wayfinder ticket #109 — Reading). Three variants of the
// reading surface on /prototype/reading, switchable via `?variant=`; each renders
// the adopted shell plus a 390px mobile frame. Mocked data, no API calls; the
// switcher is dev-only.

import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { FocusReader } from "./reading/variants/FocusReader.tsx";
import { ReadingShelf } from "./reading/variants/ReadingShelf.tsx";
import { ReadingStudio } from "./reading/variants/ReadingStudio.tsx";

const VARIANTS = ["A", "B", "C"];
const LABELS: Record<string, string> = {
  A: "Leitura em foco",
  B: "Mesa de leitura",
  C: "Estante",
};

export function ReadingPrototype() {
  const [params] = useSearchParams();
  const raw = params.get("variant");
  const variant = raw && VARIANTS.includes(raw) ? raw : "A";

  return (
    <>
      {variant === "A" && <FocusReader />}
      {variant === "B" && <ReadingStudio />}
      {variant === "C" && <ReadingShelf />}
      <PrototypeSwitcher variants={VARIANTS} labels={LABELS} />
    </>
  );
}
