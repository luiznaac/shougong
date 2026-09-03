// Convert numbered pinyin ("zhi1 dao4", "nv3", "lu:4") to accented pinyin,
// and expose the tone number per syllable so the UI can colour it.

const TONE_MARKS: Record<string, string[]> = {
  a: ["a", "ā", "á", "ǎ", "à", "a"],
  e: ["e", "ē", "é", "ě", "è", "e"],
  i: ["i", "ī", "í", "ǐ", "ì", "i"],
  o: ["o", "ō", "ó", "ǒ", "ò", "o"],
  u: ["u", "ū", "ú", "ǔ", "ù", "u"],
  "ü": ["ü", "ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

export interface PinyinSyllable {
  /** accented form, e.g. "zhī" */
  text: string;
  /** 1–4, or 5 for neutral tone */
  tone: number;
}

function placeToneMark(syllable: string, tone: number): string {
  if (tone < 1 || tone > 4) return syllable;

  // Normalise ü spellings.
  let s = syllable.replace(/u:/g, "ü").replace(/v/g, "ü");

  // Standard rule: a or e always take the mark; then "ou"; otherwise the last vowel.
  const lower = s.toLowerCase();
  let idx = -1;
  if (lower.includes("a")) idx = lower.indexOf("a");
  else if (lower.includes("e")) idx = lower.indexOf("e");
  else if (lower.includes("ou")) idx = lower.indexOf("o");
  else {
    for (let i = s.length - 1; i >= 0; i--) {
      if ("aeiouü".includes(lower[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx === -1) return s;

  const vowel = lower[idx];
  const marked = TONE_MARKS[vowel]?.[tone] ?? vowel;
  return s.slice(0, idx) + marked + s.slice(idx + 1);
}

/** Parse one space-separated numbered-pinyin string into accented syllables. */
export function parsePinyin(numbered: string): PinyinSyllable[] {
  return numbered
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^([a-zA-Zü:]+)([1-5])?$/);
      if (!m) return { text: raw, tone: 5 };
      const tone = m[2] ? Number(m[2]) : 5;
      return { text: placeToneMark(m[1], tone), tone };
    });
}

/** Plain accented string, no colour. */
export function toAccented(numbered: string): string {
  return parsePinyin(numbered)
    .map((s) => s.text)
    .join(" ");
}
