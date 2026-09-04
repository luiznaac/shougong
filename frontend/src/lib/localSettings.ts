import { useCallback, useState } from "react";

const ENABLED_KEY = "shougong.handwriting.enabled";
const TOLERANCE_KEY = "shougong.handwriting.tolerancePercent";

export const TOLERANCE_PRESETS = [0, 10, 20, 30, 40, 50] as const;

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as boolean);
  } catch {
    return fallback;
  }
}

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as number;
    return TOLERANCE_PRESETS.includes(parsed as (typeof TOLERANCE_PRESETS)[number]) ? parsed : fallback;
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

export function useHandwritingTolerance(): [number, (v: number) => void] {
  const [value, setValue] = useState(() => readNumber(TOLERANCE_KEY, 0));
  const set = useCallback((v: number) => {
    localStorage.setItem(TOLERANCE_KEY, JSON.stringify(v));
    setValue(v);
  }, []);
  return [value, set];
}

/**
 * A fixed mistake count doesn't scale: 2 mistakes on a 3-stroke character is
 * too lenient, but on a 10+ stroke one it's reasonable. Scale by the
 * character's own stroke count instead.
 */
export function allowedMistakes(strokeCount: number, tolerancePercent: number): number {
  return Math.floor((strokeCount * tolerancePercent) / 100);
}
