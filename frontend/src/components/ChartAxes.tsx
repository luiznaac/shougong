import type { ReactNode } from "react";
import { keyedOccurrences } from "../lib/occurrenceKeys.ts";

/**
 * The shared chart frame: HTML tick columns beside the plot and HTML date labels
 * below it, so axis text never scales with the SVG and stays readable. Used by
 * the dashboard's learned chart (one Y axis) and the item trajectory (two).
 *
 * Ticks are passed top-to-bottom; `rightTicks` adds the second Y axis.
 */
export function ChartAxes({
  leftTicks,
  rightTicks,
  dateTicks,
  height,
  leftClassName = "text-accent-500",
  rightClassName = "text-sky-500",
  children,
}: {
  leftTicks: string[];
  rightTicks?: string[];
  dateTicks: string[];
  height: number;
  leftClassName?: string;
  rightClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <TickColumn ticks={leftTicks} align="right" className={leftClassName} />
      <div className="min-w-0 flex-1">
        <div style={{ height }}>{children}</div>
        <div
          className={`mt-1 flex text-[10px] text-slate-500 ${
            dateTicks.length === 1 ? "justify-center" : "justify-between"
          }`}
        >
          {keyedOccurrences(dateTicks, (label) => label).map(({ key, item: label }) => (
            <span key={key} className="tabular-nums">
              {label}
            </span>
          ))}
        </div>
      </div>
      {rightTicks ? (
        <TickColumn ticks={rightTicks} align="left" className={rightClassName} />
      ) : null}
    </div>
  );
}

function TickColumn({
  ticks,
  align,
  className,
}: {
  ticks: string[];
  align: "left" | "right";
  className: string;
}) {
  return (
    <div
      className={`flex flex-col justify-between text-[10px] tabular-nums ${className} ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {keyedOccurrences(ticks, (tick) => tick).map(({ key, item: tick }) => (
        <span key={key}>{tick}</span>
      ))}
    </div>
  );
}
