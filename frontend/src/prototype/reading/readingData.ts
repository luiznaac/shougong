// Throwaway prototype data (wayfinder ticket #109 — Reading). Mirrors the shape
// of SavedReadingText closely enough to judge layout; nothing hits the API.

export type MockFormat = "paragraph" | "sentences" | "dialogue";

export interface MockToken {
  text: string;
  isWord: boolean;
  pinyin?: string; // numbered pinyin, as the backend sends it
  pos?: string;
  definitions?: string[];
  extra?: boolean;
  entryId?: number;
}

export interface MockReading {
  id: number;
  format: MockFormat;
  model: string;
  topic: string | null;
  topicGenerated: boolean;
  attempts: number;
  extraWords: string[];
  tokens: MockToken[];
  createdAt: string;
}

export interface MockHistoryEntry {
  id: number;
  format: MockFormat;
  model: string;
  topic: string | null;
  extra: number;
  attempts: number;
  tokens: number;
  createdAt: string;
  preview: string;
}

const w = (
  text: string,
  pinyin: string,
  pos: string,
  definitions: string[],
  extra = false,
): MockToken => ({ text, isWord: true, pinyin, pos, definitions, extra, entryId: text.length });

const p = (text: string): MockToken => ({ text, isWord: false });

export const READING: MockReading = {
  id: 412,
  format: "paragraph",
  model: "deepseek-v4-flash",
  topic: "a morning walk in the park",
  topicGenerated: true,
  attempts: 2,
  extraWords: ["饭馆", "然后"],
  tokens: [
    w("今天", "jin1 tian1", "noun", ["today"]),
    w("早上", "zao3 shang5", "noun", ["morning"]),
    p("，"),
    w("我", "wo3", "pronoun", ["I", "me"]),
    w("和", "he2", "conjunction", ["and", "with"]),
    w("朋友", "peng2 you5", "noun", ["friend"]),
    w("去", "qu4", "verb", ["to go"]),
    w("公园", "gong1 yuan2", "noun", ["park", "public garden"]),
    w("散步", "san4 bu4", "verb", ["to take a walk", "to stroll"]),
    p("。"),
    w("天气", "tian1 qi4", "noun", ["weather"]),
    w("很", "hen3", "adverb", ["very", "quite"]),
    w("好", "hao3", "adjective", ["good", "fine"]),
    p("，"),
    w("我们", "wo3 men5", "pronoun", ["we", "us"]),
    w("看见", "kan4 jian4", "verb", ["to see", "to catch sight of"]),
    w("了", "le5", "particle", ["(completed action marker)"]),
    w("很多", "hen3 duo1", "adjective", ["many", "a lot of"]),
    w("花", "hua1", "noun", ["flower"]),
    p("。"),
    w("中午", "zhong1 wu3", "noun", ["noon", "midday"]),
    w("我们", "wo3 men5", "pronoun", ["we", "us"]),
    w("在", "zai4", "preposition", ["at", "in"]),
    w("一个", "yi1 ge4", "quantifier", ["one", "a"]),
    w("小", "xiao3", "adjective", ["small", "little"]),
    w("饭馆", "fan4 guan3", "noun", ["restaurant", "eatery"], true),
    w("吃饭", "chi1 fan4", "verb", ["to eat", "to have a meal"]),
    p("，"),
    w("然后", "ran2 hou4", "conjunction", ["then", "after that"], true),
    w("回家", "hui2 jia1", "verb", ["to go home", "to return home"]),
    w("休息", "xiu1 xi5", "verb", ["to rest", "to take a break"]),
    p("。"),
  ],
  createdAt: "2026-11-11T12:24:00Z",
};

const PREVIEWS = [
  "今天早上，我和朋友去公园散步。天气很好，我们看见了很多花。",
  "他每天早上六点起床，喝一杯茶，然后去上班。",
  "请问，去火车站怎么走？一直走，然后向左转。",
  "昨天晚上下雨了，所以我们没有出去吃饭。",
  "她喜欢看书，也喜欢听音乐，周末常去图书馆。",
  "这个周末你有什么计划？我想去超市买东西。",
  "我们班有二十个学生，老师对我们很好。",
  "他说明天会来，但是我不太相信。",
  "北京的冬天很冷，常常下雪。",
  "我想学中文，因为中国菜很好吃。",
  "对不起，我迟到了，路上堵车了。",
  "请问这个多少钱？太贵了，可以便宜一点吗？",
];

const TOPICS = [
  "a morning walk in the park",
  "ordering at a noodle shop",
  "asking for directions",
  "a rainy weekend",
  "meeting a new classmate",
  "buying a train ticket",
  "a visit to the doctor",
  "moving into a new flat",
  "a phone call with a friend",
  "the first day at work",
];

export const HISTORY: MockHistoryEntry[] = Array.from({ length: 38 }, (_, i) => {
  const id = 412 - i;
  const formats: MockFormat[] = ["paragraph", "dialogue", "sentences"];
  return {
    id,
    format: formats[i % 3],
    model: i % 4 === 0 ? "deepseek-v4-flash" : "qwen3-30b-a3b",
    topic: i % 5 === 0 ? null : TOPICS[i % TOPICS.length],
    extra: i % 3 === 0 ? 2 : i % 7 === 0 ? 1 : 0,
    attempts: i % 6 === 0 ? 3 : 1,
    tokens: 820 + ((i * 137) % 900),
    createdAt: new Date(
      Date.UTC(2026, 10, 11 - Math.floor(i / 3), 12 - (i % 3) * 3, 24),
    ).toISOString(),
    preview: PREVIEWS[i % PREVIEWS.length],
  };
});

export const VOCAB = {
  total: 418,
  categorised: 355,
  byCategory: [
    ["verbo", 96],
    ["substantivo", 128],
    ["qualificador", 44],
    ["advérbio", 21],
    ["tempo", 18],
    ["pessoa", 14],
    ["lugar", 12],
    ["conectivo", 9],
    ["outro", 13],
  ] as [string, number][],
  byLevel: [
    ["HSK 1", 148, 100],
    ["HSK 2", 106, 88],
    ["HSK 3", 71, 42],
    ["HSK 4", 24, 9],
    ["HSK 5", 6, 1],
  ] as [string, number, number][],
};

export const ACTIVE_TOPICS = TOPICS.map((scenario, i) => ({
  id: i + 1,
  scenario,
  active: i % 4 !== 3,
}));

export const FORMAT_LABELS: Record<MockFormat, string> = {
  paragraph: "Parágrafo",
  sentences: "Frases soltas",
  dialogue: "Diálogo",
};

export const MODELS = ["deepseek-v4-flash", "qwen3-30b-a3b", "gemini-3.8-flash"];
