// Throwaway prototype (wayfinder ticket #110 — study item detail). Three variants
// of the item page on /prototype/item-detail, switchable via `?variant=`; each
// renders the adopted shell plus a 390px mobile frame. Mocked data, no API calls;
// the switcher is dev-only.

import { useSearchParams } from "react-router-dom";
import { PrototypeSwitcher } from "./PrototypeSwitcher.tsx";
import { DossierItem } from "./itemdetail/variants/DossierItem.tsx";
import { JournalItem } from "./itemdetail/variants/JournalItem.tsx";
import { TabbedItem } from "./itemdetail/variants/TabbedItem.tsx";

const VARIANTS = ["A", "B", "C"];
const LABELS: Record<string, string> = {
  A: "Ficha (rail fixo + cartões paginados)",
  B: "Abas (uma seção por vez)",
  C: "Caderno (capítulos + trilhas)",
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
      <PrototypeSwitcher variants={VARIANTS} labels={LABELS} />
    </>
  );
}
