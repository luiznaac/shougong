// Throwaway prototype asset (wayfinder ticket #105). Minimal stroke icon set so
// the shell variants do not depend on an icon library the app does not ship.

const PATHS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5ZM20 18v3H6.5",
  text: "M4 6h16M4 12h16M4 18h10",
  chart: "M4 19V9M9 19V5M14 19v-6M19 19v-9",
  sliders: "M4 6h8M16 6h4M4 12h4M12 12h8M4 18h11M19 18h1",
  plus: "M12 5v14M5 12h14",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l4.5 4.5",
  "chevron-right": "M9 5l7 7-7 7",
  "chevron-left": "M15 5l-7 7 7 7",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  close: "M6 6l12 12M18 6L6 18",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5",
  spark: "M12 3v5M12 16v5M3 12h5M16 12h5",
  // Custom-drawn replacements for the 👻 (leech) and ⚡ (priority) emoji.
  ghost:
    "M5 21V11a7 7 0 0 1 14 0v10l-2.3-1.6L14.4 21 12 19.4 9.6 21 6.7 19.4 5 21ZM9.5 11h.01M14.5 11h.01",
  bolt: "M13 2 4 14h6l-1 8 10-12h-6V2Z",
};

export function Icon({
  name,
  className = "h-5 w-5",
  strokeWidth = 1.7,
}: {
  name: keyof typeof PATHS | string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <title>{name}</title>
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
