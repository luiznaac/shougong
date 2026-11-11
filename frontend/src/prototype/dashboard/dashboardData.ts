// Throwaway prototype data (wayfinder ticket #107 — Dashboard).
// Mocked; the dashboard layout is being judged, not the backend. Shapes mirror
// StudyItem closely enough for realistic density, and the set is large enough to
// make pagination / "load more" behave for real.

import type { SrsGroup } from "../../lib/srs.ts";
import type { MockItem } from "../prototypeData.ts";

export type { MockItem };

export const DASH_ITEMS: MockItem[] = [
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
  { hanzi: "书", pinyin: "shu1", meaning: "livro", group: "novice", due: "2 d" },
  { hanzi: "茶", pinyin: "cha2", meaning: "chá", group: "apprentice", due: "3 d" },
  {
    hanzi: "钱",
    pinyin: "qian2",
    meaning: "dinheiro",
    group: "apprentice",
    due: "5 d",
    leech: true,
  },
  { hanzi: "工作", pinyin: "gong1 zuo4", meaning: "trabalho", group: "journeyman", due: "1 d" },
  { hanzi: "城市", pinyin: "cheng2 shi4", meaning: "cidade", group: "journeyman", due: "7 d" },
  { hanzi: "电脑", pinyin: "dian4 nao3", meaning: "computador", group: "expert", due: "12 d" },
  { hanzi: "医院", pinyin: "yi1 yuan4", meaning: "hospital", group: "expert", due: "3 d" },
  { hanzi: "起床", pinyin: "qi3 chuang2", meaning: "levantar", group: "apprentice", due: "hoje" },
  { hanzi: "帮忙", pinyin: "bang1 mang2", meaning: "ajudar", group: "journeyman", due: "2 d" },
  { hanzi: "认识", pinyin: "ren4 shi", meaning: "reconhecer", group: "novice", due: "amanhã" },
  { hanzi: "旅游", pinyin: "lv3 you2", meaning: "viajar", group: "expert", due: "8 d" },
  {
    hanzi: "音乐",
    pinyin: "yin1 yue4",
    meaning: "música",
    group: "master",
    due: "15 d",
    leech: true,
  },
  {
    hanzi: "世界",
    pinyin: "shi4 jie4",
    meaning: "mundo",
    group: "master",
    due: "20 d",
    pinned: true,
  },
  { hanzi: "明白", pinyin: "ming2 bai", meaning: "compreender", group: "journeyman", due: "hoje" },
  { hanzi: "名字", pinyin: "ming2 zi", meaning: "nome", group: "novice", due: "4 d" },
];

export const DASH_LEECHES = DASH_ITEMS.filter((item) => item.leech);

export const DASH_TALLY: Record<SrsGroup, number> = DASH_ITEMS.reduce(
  (acc, item) => {
    acc[item.group] += 1;
    return acc;
  },
  { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 } as Record<SrsGroup, number>,
);

export const DASH_COUNTS = {
  lessons: 3,
  reviews: 24,
  dueToday: 24,
  streak: 12,
  learned: 128,
};

export const UPCOMING = [
  { day: "Amanhã", count: 8 },
  { day: "Qua", count: 6 },
  { day: "Qui", count: 4 },
  { day: "Sex", count: 11 },
  { day: "Sáb", count: 3 },
  { day: "Dom", count: 7 },
  { day: "Seg", count: 2 },
];

export const UPCOMING_TOTAL = UPCOMING.reduce((n, d) => n + d.count, 0);

// Cumulative items learned, oldest → newest. Ends near DASH_COUNTS.learned.
export const LEARNED_SERIES = [
  0, 2, 5, 9, 12, 12, 16, 21, 27, 31, 31, 36, 44, 49, 55, 55, 62, 68, 74, 74, 81, 88, 96, 103, 103,
  110, 116, 121, 125, 128,
];

export const EXTRA_STUDY = {
  recent_mistakes: DASH_LEECHES,
  recently_learned: [DASH_ITEMS[0], DASH_ITEMS[1], DASH_ITEMS[12], DASH_ITEMS[21], DASH_ITEMS[26]],
} as const;

export type DashboardState = "ready" | "loading" | "empty";
