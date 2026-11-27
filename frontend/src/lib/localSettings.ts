import { useCallback, useState } from "react";

const ENABLED_KEY = "shougong.handwriting.enabled";
const AUTO_REVEAL_KEY = "shougong.handwriting.autoReveal";

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as boolean);
  } catch {
    return fallback;
  }
}

/** One per-browser boolean preference persisted under a localStorage key. */
function useLocalBool(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => readBool(key, fallback));
  const set = useCallback(
    (v: boolean) => {
      localStorage.setItem(key, JSON.stringify(v));
      setValue(v);
    },
    [key],
  );
  return [value, set];
}

/**
 * Per-browser preference: whether the quiz's "write from memory" step is an
 * interactive handwriting check (good on a touchscreen) or just a flip-card
 * recall with manual self-grading (better with a mouse). Not synced across
 * devices on purpose — each browser keeps its own setting.
 */
export function useHandwritingEnabled(): [boolean, (v: boolean) => void] {
  return useLocalBool(ENABLED_KEY, false);
}

/**
 * Per-browser preference: whether finishing the last character of the
 * handwriting self-check reveals the whole-word comparison automatically. On by
 * default; off leaves the final reveal to the learner's "Revelar" tap. Like the
 * handwriting toggle, it is not synced across devices.
 */
export function useAutoReveal(): [boolean, (v: boolean) => void] {
  return useLocalBool(AUTO_REVEAL_KEY, true);
}
