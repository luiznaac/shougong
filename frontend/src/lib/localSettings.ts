import { useCallback, useState } from "react";

const ENABLED_KEY = "shougong.handwriting.enabled";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as boolean);
  } catch {
    return fallback;
  }
}

/**
 * Per-browser preference: whether the quiz's "write from memory" step is an
 * interactive handwriting check (good on a touchscreen) or just a flip-card
 * recall with manual self-grading (better with a mouse). Not synced across
 * devices on purpose — each browser keeps its own setting.
 */
export function useHandwritingEnabled(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => readBool(ENABLED_KEY, false));
  const set = useCallback((v: boolean) => {
    localStorage.setItem(ENABLED_KEY, JSON.stringify(v));
    setValue(v);
  }, []);
  return [value, set];
}
