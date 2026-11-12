// pt-BR labels for the reading generator's working-set group keys
// (`backend/src/shougong/usecase/reading/working_set.py` → `_GROUP_LABELS`,
// plus the `always_available` function-word floor and the flat `words` group
// used when the known vocabulary is too small to sample). Exhaustive, so a new
// backend group fails the type until it is translated here.
export type WorkingSetGroup =
  | "always_available"
  | "words"
  | "verbs"
  | "nouns"
  | "people"
  | "places"
  | "descriptions"
  | "time"
  | "quantity"
  | "connectives"
  | "adverbs"
  | "other";

const LABELS_PT: Record<WorkingSetGroup, string> = {
  always_available: "sempre disponíveis",
  words: "palavras",
  verbs: "verbos",
  nouns: "substantivos",
  people: "pessoas",
  places: "lugares",
  descriptions: "qualificadores",
  time: "tempo",
  quantity: "quantidade",
  connectives: "conectivos",
  adverbs: "advérbios",
  other: "outros",
};

export function workingSetGroupLabel(group: string): string {
  return LABELS_PT[group as WorkingSetGroup] ?? group;
}
