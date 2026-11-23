const CHIP = "rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400";

/** `HSK 3` for levels 1-6; the standard's single 7-9 band for 7 and above. */
export function levelLabel(level: number): string {
  return level >= 7 ? "HSK 7-9" : `HSK ${level}`;
}

/** The quiet vocabulary-level chip; a word outside HSK 3.0 reads "sem HSK". */
export function HskChip({ level }: { level: number | null }) {
  return <span className={CHIP}>{level == null ? "sem HSK" : levelLabel(level)}</span>;
}

/**
 * The word's handwriting level, derived as the max writing level of its
 * characters. A word with no levelled character shows an unknown marker rather
 * than a number.
 */
export function HandwritingChip({ level }: { level: number | null }) {
  return (
    <span className={CHIP} title={level == null ? "Nível de escrita desconhecido" : undefined}>
      {level == null ? "escrita —" : `escrita ${levelLabel(level)}`}
    </span>
  );
}

/** Both levels a word carries: vocabulary first, then handwriting. */
export function WordLevels({
  hskLevel,
  handwritingLevel,
}: {
  hskLevel: number | null;
  handwritingLevel: number | null;
}) {
  return (
    <>
      <HskChip level={hskLevel} />
      <HandwritingChip level={handwritingLevel} />
    </>
  );
}
