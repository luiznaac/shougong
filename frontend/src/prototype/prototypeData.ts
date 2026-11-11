// Throwaway prototype data (wayfinder ticket #105). Mocked — the shell is being
// judged, not the backend. Shapes mirror StudyItem closely enough for realistic
// density.

import type { SrsGroup } from "../lib/srs.ts";

export interface MockItem {
  hanzi: string;
  pinyin: string;
  meaning: string;
  group: SrsGroup;
  due: string;
  leech?: boolean;
  pinned?: boolean;
}

export const MOCK_ITEMS: MockItem[] = [
  { hanzi: "你好", pinyin: "ni3 hao3", meaning: "olá", group: "novice", due: "hoje" },
  { hanzi: "学习", pinyin: "xue2 xi2", meaning: "estudar", group: "novice", due: "hoje" },
  { hanzi: "谢谢", pinyin: "xie4 xie", meaning: "obrigado", group: "novice", due: "amanhã" },
  { hanzi: "水", pinyin: "shui3", meaning: "água", group: "apprentice", due: "hoje", leech: true },
  { hanzi: "火", pinyin: "huo3", meaning: "fogo", group: "apprentice", due: "amanhã" },
  {
    hanzi: "学校",
    pinyin: "xue2 xiao4",
    meaning: "escola",
    group: "apprentice",
    due: "2 d",
    pinned: true,
  },
  { hanzi: "老师", pinyin: "lao3 shi1", meaning: "professor", group: "journeyman", due: "hoje" },
  { hanzi: "朋友", pinyin: "peng2 you3", meaning: "amigo", group: "journeyman", due: "3 d" },
  { hanzi: "时间", pinyin: "shi2 jian1", meaning: "tempo", group: "journeyman", due: "4 d" },
  { hanzi: "中国", pinyin: "zhong1 guo2", meaning: "China", group: "expert", due: "6 d" },
  {
    hanzi: "吃饭",
    pinyin: "chi1 fan4",
    meaning: "comer",
    group: "expert",
    due: "hoje",
    leech: true,
  },
  { hanzi: "说话", pinyin: "shuo1 hua4", meaning: "falar", group: "master", due: "9 d" },
];

export const SRS_COUNTS: Record<SrsGroup, number> = {
  novice: 3,
  apprentice: 6,
  journeyman: 15,
  expert: 4,
  master: 2,
};

export const SRS_LABEL: Record<SrsGroup, string> = {
  novice: "Novice",
  apprentice: "Apprentice",
  journeyman: "Journeyman",
  expert: "Expert",
  master: "Master",
};

export const DUE_WEEK = [
  { day: "Seg", count: 8 },
  { day: "Ter", count: 6 },
  { day: "Qua", count: 4 },
  { day: "Qui", count: 11 },
  { day: "Sex", count: 3 },
  { day: "Sáb", count: 7 },
  { day: "Dom", count: 2 },
];

export const COUNTS = {
  lessons: 3,
  reviews: 24,
  dueToday: 24,
  streak: 12,
};
