/**
 * The badge practice carries instead of a write flag: the run is structurally
 * unrecorded, so the learner's SRS does not move.
 */
export function SrsIntactChip() {
  return (
    <span
      title="Prática não registrada — seu SRS não muda"
      className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/90 uppercase ring-1 ring-white/20"
    >
      SRS intacto
    </span>
  );
}
