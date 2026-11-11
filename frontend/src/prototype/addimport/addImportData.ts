// Throwaway mocked data (wayfinder ticket #108 — Add items and Batch import).
// Shapes mirror the real DTOs in src/api/types.ts so the variants read against
// the same density the app will carry. No API calls.

import type { BatchImportOutcome, DictionaryEntry } from "../../api/types.ts";

export const DICTIONARY: DictionaryEntry[] = [
  {
    id: 1,
    simplified: "学习",
    pinyin: "xue2 xi2",
    definitions: ["to study", "to learn"],
    hsk_level: 1,
    pos_tags: ["v"],
  },
  {
    id: 2,
    simplified: "你好",
    pinyin: "ni3 hao3",
    definitions: ["hello", "hi"],
    hsk_level: 1,
    pos_tags: ["int"],
  },
  {
    id: 3,
    simplified: "谢谢",
    pinyin: "xie4 xie5",
    definitions: ["thanks", "thank you"],
    hsk_level: 1,
    pos_tags: ["v"],
  },
  {
    id: 4,
    simplified: "朋友",
    pinyin: "peng2 you3",
    definitions: ["friend"],
    hsk_level: 1,
    pos_tags: ["n"],
  },
  {
    id: 5,
    simplified: "时间",
    pinyin: "shi2 jian1",
    definitions: ["time", "period"],
    hsk_level: 2,
    pos_tags: ["n"],
  },
  {
    id: 6,
    simplified: "知道",
    pinyin: "zhi1 dao4",
    definitions: ["to know", "to be aware of"],
    hsk_level: 2,
    pos_tags: ["v"],
  },
  {
    id: 7,
    simplified: "喜欢",
    pinyin: "xi3 huan5",
    definitions: ["to like", "to be fond of"],
    hsk_level: 1,
    pos_tags: ["v"],
  },
  {
    id: 8,
    simplified: "高兴",
    pinyin: "gao1 xing4",
    definitions: ["happy", "glad"],
    hsk_level: 2,
    pos_tags: ["adj"],
  },
  {
    id: 9,
    simplified: "汉语",
    pinyin: "han4 yu3",
    definitions: ["Chinese language"],
    hsk_level: 1,
    pos_tags: ["n"],
  },
  {
    id: 10,
    simplified: "汉字",
    pinyin: "han4 zi4",
    definitions: ["Chinese character"],
    hsk_level: 2,
    pos_tags: ["n"],
  },
  {
    id: 11,
    simplified: "学生",
    pinyin: "xue2 sheng5",
    definitions: ["student", "pupil"],
    hsk_level: 1,
    pos_tags: ["n"],
  },
  {
    id: 12,
    simplified: "老师",
    pinyin: "lao3 shi1",
    definitions: ["teacher"],
    hsk_level: 2,
    pos_tags: ["n"],
  },
  {
    id: 13,
    simplified: "中国",
    pinyin: "zhong1 guo2",
    definitions: ["China"],
    hsk_level: 1,
    pos_tags: ["n"],
  },
  {
    id: 14,
    simplified: "今天",
    pinyin: "jin1 tian1",
    definitions: ["today"],
    hsk_level: 1,
    pos_tags: ["n"],
  },
  {
    id: 15,
    simplified: "明天",
    pinyin: "ming2 tian1",
    definitions: ["tomorrow"],
    hsk_level: 1,
    pos_tags: ["n"],
  },
  {
    id: 16,
    simplified: "工作",
    pinyin: "gong1 zuo4",
    definitions: ["work", "job", "to work"],
    hsk_level: 3,
    pos_tags: ["n", "v"],
  },
];

const AMBIGUOUS = new Set([2, 10, 56]);

/** 1000 mocked import outcomes — enough to exercise the pager honestly. */
export const BATCH_OUTCOMES: BatchImportOutcome[] = Array.from({ length: 1000 }, (_, i) => {
  const entry = DICTIONARY[i % DICTIONARY.length];
  const row = i + 1;
  if (AMBIGUOUS.has(i)) {
    return {
      row,
      hanzi: entry.simplified,
      pinyin: entry.pinyin,
      status: "error",
      study_item_id: null,
      detail: "mais de uma entrada casou com hanzi + pinyin",
      candidates: [entry, DICTIONARY[(i + 3) % DICTIONARY.length]],
    } as BatchImportOutcome;
  }
  if (i % 9 === 3) {
    return {
      row,
      hanzi: entry.simplified,
      pinyin: entry.pinyin,
      status: "error",
      study_item_id: null,
      detail: "pinyin inválido: use tons numéricos (ex.: xue2 xi2)",
      candidates: [],
    } as BatchImportOutcome;
  }
  if (i % 7 === 4) {
    return {
      row,
      hanzi: entry.simplified,
      pinyin: entry.pinyin,
      status: "skipped",
      study_item_id: null,
      detail: "já está na fila",
      candidates: [],
    } as BatchImportOutcome;
  }
  return {
    row,
    hanzi: entry.simplified,
    pinyin: entry.pinyin,
    status: "created",
    study_item_id: row + 400,
    detail: null,
    candidates: [],
  } as BatchImportOutcome;
});

export const BATCH_FILE = "meus-hanzi-novos.csv";

export const BATCH_TEXT = [
  "学习,xue2 xi2",
  "你好,ni3 hao3",
  "汉字,han4 zi4",
  "谢谢,xie4 xie5",
].join("\n");

/** Rows the mocked dictionary search returns for the empty query (paged). */
export const QUEUE_IDS = new Set([1, 2, 3, 5, 7, 9, 11]);

export const COUNTS = { queued: 213, dueToday: 47, importRun: 412 };
