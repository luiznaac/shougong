// Throwaway prototype (wayfinder ticket #110 — study item detail). Six variants
// of the item page on /prototype/item-detail, switchable via `?variant=`; each
// renders the adopted shell plus a 390px mobile frame. Mocked data, no API calls;
// the switcher is dev-only.

import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { BentoItem } from "./itemdetail/variants/BentoItem.tsx";
import { DossierItem } from "./itemdetail/variants/DossierItem.tsx";
import { FichaTabsItem } from "./itemdetail/variants/FichaTabsItem.tsx";
import { JournalItem } from "./itemdetail/variants/JournalItem.tsx";
import { TabbedItem } from "./itemdetail/variants/TabbedItem.tsx";
import { WorkbenchItem } from "./itemdetail/variants/WorkbenchItem.tsx";

const VARIANTS = ["A", "B", "C", "D", "E", "F"];
const LABELS: Record<string, string> = {
  A: "Ficha (rail fixo)",
  B: "Abas (uma seção por vez)",
  C: "Caderno (capítulos + trilhas)",
  D: "Ficha com abas (+ leituras)",
  E: "Bancada (leitura em contexto)",
  F: "Bento (tiles)",
};

export function ItemDetailPrototype() {
  const [params] = useSearchParams();
  const raw = params.get("variant");
  const variant = raw && VARIANTS.includes(raw) ? raw : "A";

  return (
    <>
      {variant === "A" && <DossierItem />}
      {variant === "B" && <TabbedItem />}
      {variant === "C" && <JournalItem />}
      {variant === "D" && <FichaTabsItem />}
      {variant === "E" && <WorkbenchItem />}
      {variant === "F" && <BentoItem />}
      <PrototypeSwitcher variants={VARIANTS} labels={LABELS} />
    </>
  );
}
