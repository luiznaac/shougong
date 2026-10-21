export interface KeyedItem<T> {
  key: string;
  item: T;
}

/**
 * React keys for an ordered list whose items have no unique id: the key is the
 * `keyOf` projection, suffixed with an occurrence counter when the same value
 * repeats (so `["a", "a"]` becomes `a` and `a#1`). Two items never share a key.
 * When `keyOf` values are distinct, a reorder keeps each item's key.
 */
export function keyedOccurrences<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): KeyedItem<T>[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { key: occurrence === 0 ? base : `${base}#${occurrence}`, item };
  });
}
