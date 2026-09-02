import { parsePinyin } from "../lib/pinyin.ts";

interface Props {
  /** numbered pinyin, e.g. "zhi1 dao4" */
  value: string;
  className?: string;
  /** when false, render without tone colours */
  coloured?: boolean;
}

export function Pinyin({ value, className = "", coloured = true }: Props) {
  const syllables = parsePinyin(value);
  return (
    <span className={className} lang="zh-Latn">
      {syllables.map((s, i) => (
        <span key={i}>
          <span className={coloured ? `tone-${s.tone}` : undefined}>{s.text}</span>
          {i < syllables.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}
