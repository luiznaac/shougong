import { useCallback, useSyncExternalStore } from "react";

/** The two presentations a responsive surface renders; pages pick one per breakpoint. */
export type Presentation = "desktop" | "mobile";

/**
 * Subscribe to a CSS media query. It is an external store, so it reads through
 * `useSyncExternalStore` rather than an effect that mirrors it into state.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
