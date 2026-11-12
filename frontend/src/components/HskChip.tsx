/** The quiet HSK level chip shared by the item header and related rows. */
export function HskChip({ level }: { level: number | null }) {
  if (level == null) return null;
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">HSK {level}</span>
  );
}
