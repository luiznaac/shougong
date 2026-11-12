import type { StudyItem } from "../api/types.ts";
import { srsStateLabel } from "../i18n/srsState.ts";
import { formatDate, formatDateTime, fromNow } from "./format.ts";

export interface ItemFact {
  label: string;
  value: string;
  /** The exact instant behind a relative value, for a tooltip. */
  title?: string;
}

/**
 * The FSRS card as plain-language facts — the item page's facts line. State
 * names come from the i18n map (never the backend enum), intervals read as
 * relative time, and missing measurements stay an em dash instead of a
 * zero-looking number.
 */
export function fsrsFacts(item: StudyItem): ItemFact[] {
  const { card } = item;
  return [
    { label: "Estado", value: srsStateLabel(card.state) },
    {
      label: "Próxima revisão",
      value: fromNow(card.due),
      title: formatDateTime(card.due),
    },
    {
      label: "Estabilidade",
      value: card.stability == null ? "—" : `${card.stability.toFixed(1)} dias`,
    },
    {
      label: "Dificuldade",
      value: card.difficulty == null ? "—" : `${card.difficulty.toFixed(1)} de 10`,
    },
    {
      label: "Último review",
      value: card.last_review ? fromNow(card.last_review) : "nunca",
      title: card.last_review ? formatDateTime(card.last_review) : undefined,
    },
    { label: "Adicionado", value: formatDate(item.created_at) },
  ];
}
