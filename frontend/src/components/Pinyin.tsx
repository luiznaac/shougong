import { keyedOccurrences } from "../lib/occurrenceKeys.ts";
import { parsePinyin } from "../lib/pinyin.ts";

interface Props {
  /** numbered pinyin, e.g. "zhi1 dao4" */
  value: string;
  className?: string;
  /** when false, render without tone colours */
  coloured?: boolean;
}

export function Pinyin({ value, className = "", coloured = true }: Props) {
  const syllables = keyedOccurrences(parsePinyin(value), (s) => `${s.text}-${s.tone}`);
  return (
    <span className={className} lang="zh-Latn">
      {syllables.map(({ key, item: s }, i) => (
        <span key={key}>
          <span className={coloured ? `tone-${s.tone}` : undefined}>{s.text}</span>
          {i < syllables.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
