import type { ReactNode } from "react";

// Inline stroke icons — no icon library. 24×24 box, round caps and joins; the
// badge pair (ghost/bolt) carries the heavier 2.6 stroke the spec fixes.
export const ICON_NAMES = [
  "home",
  "book",
  "text",
  "chart",
  "sliders",
  "plus",
  "menu",
  "search",
  "chevron-left",
  "chevron-right",
  "grid",
  "clock",
  "upload",
  "user",
  "more",
  "close",
  "arrow-right",
  "layers",
  "spark",
  "ghost",
  "bolt",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  text: (
    <>
      <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
    </>
  ),
  chart: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V11" />
      <path d="M12 21V5" />
      <path d="M18 21v-8" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h4M12 17h8" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  "arrow-right": (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.3 6.3 2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8" />
    </>
  ),
  ghost: (
    <>
      <path d="M4 21V10a8 8 0 0 1 16 0v11l-2.7-2-2.6 2-2.7-2-2.6 2-2.7-2-2.7 2Z" />
      <path d="M9 10.5v.01M15 10.5v.01" />
    </>
  ),
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Accessible name; omit for a decorative icon. */
  label?: string;
}

export function Icon({ name, size = 24, strokeWidth = 1.7, className, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The leech badge — a drawn ghost replacing the 👻 emoji. */
export function GhostIcon({ size = 14, label }: { size?: number; label?: string }) {
  return <Icon name="ghost" size={size} strokeWidth={2.6} label={label} />;
}

/** The priority badge — a drawn bolt replacing the ⚡ emoji. */
export function BoltIcon({ size = 14, label }: { size?: number; label?: string }) {
  return <Icon name="bolt" size={size} strokeWidth={2.6} label={label} />;
}
