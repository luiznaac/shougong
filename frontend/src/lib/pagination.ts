// The generic pagination arithmetic every list surface shares. The per-surface
// density (24, 12, 8, 5…) is the caller's, never baked in here.

export interface ItemPageRequest {
  limit: number;
  offset: number;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The server offset of a 1-based page. */
export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/** Page numbers to render, `null` marking an ellipsis gap. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const visible = new Set<number>([1, pages]);
  for (let n = Math.max(1, page - 2); n <= Math.min(pages, page + 2); n += 1) visible.add(n);
  const numbers = [...visible].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const [index, n] of numbers.entries()) {
    if (index > 0 && n - numbers[index - 1] > 1) out.push(null);
    out.push(n);
  }
  return out;
}
