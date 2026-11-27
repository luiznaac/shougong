import { type RefCallback, useCallback, useState, useSyncExternalStore } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

const ZERO: ElementSize = { width: 0, height: 0 };
const snapshots = new WeakMap<Element, ElementSize>();

/**
 * The element's current size, memoized per node so `useSyncExternalStore` sees a
 * reference-stable snapshot: the same node at the same size returns the same
 * object, and the cache drops with the node.
 */
function snapshotOf(node: Element | null): ElementSize {
  if (!node) return ZERO;
  const rect = node.getBoundingClientRect();
  const previous = snapshots.get(node);
  if (previous && previous.width === rect.width && previous.height === rect.height) {
    return previous;
  }
  const next = { width: rect.width, height: rect.height };
  snapshots.set(node, next);
  return next;
}

/**
 * Tracks an element's box through the external-store hook, since a box changes
 * outside React: `ResizeObserver` is the subscription and the snapshot reads the
 * node's bounding box. The node is held in state so replacing it re-subscribes;
 * the first measurement lands on the render after the callback ref attaches it.
 */
export function useElementSize<T extends HTMLElement = HTMLElement>(): {
  ref: RefCallback<T>;
  size: ElementSize;
} {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback<RefCallback<T>>((next) => setNode(next), []);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!node) return () => {};
      const observer = new ResizeObserver(() => onStoreChange());
      observer.observe(node);
      return () => observer.disconnect();
    },
    [node],
  );

  const getSnapshot = useCallback(() => snapshotOf(node), [node]);

  const size = useSyncExternalStore(subscribe, getSnapshot, () => ZERO);
  return { ref, size };
}
