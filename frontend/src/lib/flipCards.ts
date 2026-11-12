/** The flip-card layout for one practice word. */
export interface FlipLayout {
  /** tile edge, in CSS pixels */
  size: number;
  /** row-major indices into the word's characters; rows are balanced */
  rows: number[][];
}

const CAP = 132;
const GAP = 10;

/**
 * Size one tile per character in the available width. Short words keep the
 * size cap; longer ones shrink down to the 56px floor and then wrap into
 * balanced rows, so a five- to seven-character word never turns into confetti.
 */
export function flipLayout({
  count,
  available,
  min = 56,
}: {
  count: number;
  available: number;
  min?: number;
}): FlipLayout {
  const total = Math.max(0, count);
  if (total === 0) return { size: min, rows: [] };

  const sizeFor = (perRow: number) =>
    Math.min(CAP, Math.floor((available - (perRow - 1) * GAP) / perRow));

  let perRow = total;
  let size = sizeFor(perRow);
  while (size < min && perRow > 1) {
    perRow = Math.ceil(perRow / 2);
    size = sizeFor(perRow);
  }

  const rows: number[][] = [];
  for (let start = 0; start < total; start += perRow) {
    const row = Array.from(
      { length: Math.min(perRow, total - start) },
      (_, offset) => start + offset,
    );
    rows.push(row);
  }
  return { size, rows };
}
