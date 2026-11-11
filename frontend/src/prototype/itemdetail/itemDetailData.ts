// Throwaway prototype data (wayfinder ticket #110 — study item detail).
// Mirrors the shapes of GET /study-items/{id}, /history and /dictionary search,
// with enough rows to exercise pagination. No API calls.

import type { SrsState } from "../../api/types.ts";

export interface MockItem {
  id: number;
  entry: {
    id: number;
    simplified: string;
    pinyin: string;
    definitions: string[];
    hsk_level: number | null;
    pos_tags: string[];
  };
  card: {
    state: SrsState;
    due: string;
    stability: number;
    difficulty: number;
    last_review: string;
  };
  created_at: string;
  priority_position: number | null;
  is_leech: boolean;
}

export const ITEM: MockItem = {
  id: 42,
  entry: {
    id: 118,
    simplified: "知道",
    pinyin: "zhi1 dao4",
    definitions: ["to know", "to be aware of", "to realize"],
    hsk_level: 2,
    pos_tags: ["verb"],
  },
  card: {
    state: "review",
    due: "2026-11-14T09:00:00Z",
    stability: 21.4,
    difficulty: 4.82,
    last_review: "2026-11-02T21:13:00Z",
  },
  created_at: "2026-09-18T14:22:00Z",
  priority_position: 3,
  is_leech: false,
};

export interface MockSnapshot {
  created_at: string;
  state: SrsState;
  stability: number;
  difficulty: number;
  due: string;
}

// Newest first, like GET /study-items/{id}/history.
export const HISTORY: MockSnapshot[] = [
  {
    created_at: "2026-11-02T21:13:00Z",
    state: "review",
    stability: 21.4,
    difficulty: 4.82,
    due: "2026-11-14T09:00:00Z",
  },
  {
    created_at: "2026-10-28T20:41:00Z",
    state: "review",
    stability: 17.9,
    difficulty: 4.91,
    due: "2026-11-02T09:00:00Z",
  },
  {
    created_at: "2026-10-23T08:02:00Z",
    state: "review",
    stability: 14.2,
    difficulty: 5.03,
    due: "2026-10-28T09:00:00Z",
  },
  {
    created_at: "2026-10-18T22:17:00Z",
    state: "review",
    stability: 11.6,
    difficulty: 4.88,
    due: "2026-10-23T09:00:00Z",
  },
  {
    created_at: "2026-10-13T19:35:00Z",
    state: "review",
    stability: 8.9,
    difficulty: 5.12,
    due: "2026-10-18T09:00:00Z",
  },
  {
    created_at: "2026-10-08T07:48:00Z",
    state: "learning",
    stability: 6.1,
    difficulty: 5.44,
    due: "2026-10-13T09:00:00Z",
  },
  {
    created_at: "2026-10-03T21:06:00Z",
    state: "learning",
    stability: 4.3,
    difficulty: 5.71,
    due: "2026-10-08T09:00:00Z",
  },
  {
    created_at: "2026-09-29T18:24:00Z",
    state: "relearning",
    stability: 2.4,
    difficulty: 6.18,
    due: "2026-10-03T09:00:00Z",
  },
  {
    created_at: "2026-09-26T09:52:00Z",
    state: "learning",
    stability: 1.8,
    difficulty: 5.95,
    due: "2026-09-29T09:00:00Z",
  },
  {
    created_at: "2026-09-23T20:11:00Z",
    state: "learning",
    stability: 1.2,
    difficulty: 6.4,
    due: "2026-09-26T09:00:00Z",
  },
  {
    created_at: "2026-09-20T08:33:00Z",
    state: "learning",
    stability: 0.8,
    difficulty: 6.72,
    due: "2026-09-23T09:00:00Z",
  },
  {
    created_at: "2026-09-19T21:45:00Z",
    state: "learning",
    stability: 0.5,
    difficulty: 7.05,
    due: "2026-09-20T09:00:00Z",
  },
  {
    created_at: "2026-09-18T14:22:00Z",
    state: "learning",
    stability: 0.21,
    difficulty: 7.4,
    due: "2026-09-19T09:00:00Z",
  },
];

export interface MockRelated {
  id: number;
  simplified: string;
  pinyin: string;
  definitions: string[];
  hsk_level: number | null;
  studyItemId: number | null;
}

export const RELATED: MockRelated[] = [
  {
    id: 119,
    simplified: "知识",
    pinyin: "zhi1 shi5",
    definitions: ["knowledge", "intellectual"],
    hsk_level: 3,
    studyItemId: 87,
  },
  {
    id: 120,
    simplified: "通知",
    pinyin: "tong1 zhi1",
    definitions: ["to notify", "notice", "notification"],
    hsk_level: 3,
    studyItemId: null,
  },
  {
    id: 121,
    simplified: "道路",
    pinyin: "dao4 lu4",
    definitions: ["road", "path", "way"],
    hsk_level: 3,
    studyItemId: 61,
  },
  {
    id: 122,
    simplified: "味道",
    pinyin: "wei4 dao4",
    definitions: ["flavour", "taste", "smell"],
    hsk_level: 2,
    studyItemId: null,
  },
  {
    id: 123,
    simplified: "道理",
    pinyin: "dao4 li3",
    definitions: ["reason", "argument", "principle"],
    hsk_level: 4,
    studyItemId: null,
  },
  {
    id: 124,
    simplified: "认识",
    pinyin: "ren4 shi5",
    definitions: ["to know", "to recognise", "to meet"],
    hsk_level: 2,
    studyItemId: 15,
  },
  {
    id: 125,
    simplified: "知",
    pinyin: "zhi1",
    definitions: ["to know", "knowledge"],
    hsk_level: 4,
    studyItemId: null,
  },
  {
    id: 126,
    simplified: "道",
    pinyin: "dao4",
    definitions: ["way", "path", "to say"],
    hsk_level: 4,
    studyItemId: null,
  },
  {
    id: 127,
    simplified: "街道",
    pinyin: "jie1 dao4",
    definitions: ["street", "residential district"],
    hsk_level: 3,
    studyItemId: null,
  },
  {
    id: 128,
    simplified: "通道",
    pinyin: "tong1 dao4",
    definitions: ["passageway", "channel"],
    hsk_level: 5,
    studyItemId: null,
  },
  {
    id: 129,
    simplified: "轨道",
    pinyin: "gui3 dao4",
    definitions: ["track", "orbit", "railway"],
    hsk_level: 5,
    studyItemId: null,
  },
  {
    id: 130,
    simplified: "知觉",
    pinyin: "zhi1 jue2",
    definitions: ["perception", "consciousness"],
    hsk_level: 6,
    studyItemId: null,
  },
  {
    id: 131,
    simplified: "见识",
    pinyin: "jian4 shi5",
    definitions: ["knowledge and experience", "to broaden one's horizons"],
    hsk_level: 5,
    studyItemId: null,
  },
  {
    id: 132,
    simplified: "得知",
    pinyin: "de2 zhi1",
    definitions: ["to learn of", "to hear about"],
    hsk_level: 5,
    studyItemId: null,
  },
  {
    id: 133,
    simplified: "未知",
    pinyin: "wei4 zhi1",
    definitions: ["unknown", "unidentified"],
    hsk_level: 6,
    studyItemId: null,
  },
  {
    id: 134,
    simplified: "知名度",
    pinyin: "zhi1 ming2 du4",
    definitions: ["reputation", "how well known something is"],
    hsk_level: 6,
    studyItemId: null,
  },
  {
    id: 135,
    simplified: "知识分子",
    pinyin: "zhi1 shi5 fen4 zi3",
    definitions: ["intellectual", "intelligentsia"],
    hsk_level: 6,
    studyItemId: null,
  },
];

export const FACTS: Array<[label: string, value: string]> = [
  ["Estado FSRS", "Em revisão"],
  ["Próximo review", "14 de nov"],
  ["Estabilidade", "21,4 d"],
  ["Dificuldade", "4,82"],
  ["Último review", "02/11, 21:13"],
  ["Adicionado", "18/09, 14:22"],
];

export const STROKES = [
  { character: "知", total: 8 },
  { character: "道", total: 12 },
];

export const STATE_LABEL: Record<SrsState, string> = {
  learning: "Aprendendo",
  review: "Em revisão",
  relearning: "Reaprendendo",
};
