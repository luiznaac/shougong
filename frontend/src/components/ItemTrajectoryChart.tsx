import type { StudyItemHistory } from "../api/types.ts";
import { keyedOccurrences } from "../lib/occurrenceKeys.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";
import { ChartAxes } from "./ChartAxes.tsx";

const STABILITY_COLOR = "var(--color-accent-500)";
const DIFFICULTY_COLOR = "#0ea5e9";
const DIFFICULTY_MIN = 1;
const DIFFICULTY_MAX = 10; // FSRS difficulty is on a 1–10 scale

const axisDate = (time: number) =>
  new Date(time).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const tickLabel = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toLocaleString("pt-BR");

interface ChartModel {
  maxStability: number;
  stabilityLine: string;
  stabilityArea: string;
  difficultyLine: string;
  dateTicks: { label: string }[];
  points: {
    key: string;
    x: number;
    stability: number | null;
    difficulty: number | null;
  }[];
}

function buildModel(history: StudyItemHistory[]): ChartModel | null {
  const keyed = keyedOccurrences(
    [...history].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
    (snapshot) => snapshot.created_at,
  );

  if (keyed.length === 0) return null;

  const rows = keyed.map(({ key, item: snapshot }) => ({
    key,
    time: new Date(snapshot.created_at).getTime(),
    stability: snapshot.card.stability,
    difficulty: snapshot.card.difficulty,
  }));

  const t0 = rows[0].time;
  const t1 = rows[rows.length - 1].time;
  const span = Math.max(1, t1 - t0);
  const rawMax = Math.max(1, ...rows.map((row) => row.stability ?? 0));
  const maxStability = Math.ceil(rawMax / 5) * 5;

  const x = (time: number) => (rows.length === 1 ? 50 : ((time - t0) / span) * 100);
  const yStability = (value: number) => 100 - (value / maxStability) * 100;
  // Difficulty reads 1 at the bottom and 10 at the top — its own 1–10 scale.
  const yDifficulty = (value: number) =>
    100 - ((value - DIFFICULTY_MIN) / (DIFFICULTY_MAX - DIFFICULTY_MIN)) * 100;

  const line = (pick: (row: (typeof rows)[number]) => number | null, y: (v: number) => number) =>
    rows
      .filter((row) => pick(row) != null)
      .map((row) => `${x(row.time).toFixed(2)},${y(pick(row) as number).toFixed(2)}`)
      .join(" ");

  const stabilityLine = line((row) => row.stability, yStability);
  const stabilityArea = stabilityLine && `0,100 ${stabilityLine} 100,100`;

  const dateFractions = [0, 0.5, 1];
  const dateTicks = dateFractions.map((fraction) => ({
    label: axisDate(t0 + fraction * span),
  }));

  return {
    maxStability,
    stabilityLine,
    stabilityArea: stabilityArea ?? "",
    difficultyLine: line((row) => row.difficulty, yDifficulty),
    dateTicks: dateTicks.filter(
      (tick, index) => dateTicks.findIndex((other) => other.label === tick.label) === index,
    ),
    points: rows.map((row) => ({
      key: row.key,
      x: x(row.time),
      stability: row.stability == null ? null : yStability(row.stability),
      difficulty: row.difficulty == null ? null : yDifficulty(row.difficulty),
    })),
  };
}

/**
 * Trajetória: the FSRS snapshot history as a chart only — no duplicated
 * snapshot list. Stability (days) reads on the left axis, difficulty (1–10) on
 * the right, and local date labels sit below the plot. X is time-proportional,
 * so a long gap reads as a long gap.
 */
export function ItemTrajectoryChart({
  history,
  layout = "desktop",
}: {
  history: StudyItemHistory[];
  layout?: Presentation;
}) {
  const model = buildModel(history);

  if (!model) return <p className="text-sm text-slate-500">Sem histórico ainda.</p>;

  const halfStability = tickLabel(model.maxStability / 2);
  const halfDifficulty = tickLabel((DIFFICULTY_MIN + DIFFICULTY_MAX) / 2);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: STABILITY_COLOR }} />
          Estabilidade (dias)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full" style={{ background: DIFFICULTY_COLOR }} />
          Dificuldade (1–10)
        </span>
      </div>

      <ChartAxes
        leftTicks={[String(model.maxStability), halfStability, "0"]}
        rightTicks={[String(DIFFICULTY_MAX), halfDifficulty, String(DIFFICULTY_MIN)]}
        dateTicks={model.dateTicks.map((tick) => tick.label)}
        height={layout === "desktop" ? 208 : 260}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="Estabilidade e dificuldade ao longo do tempo"
        >
          {[0, 50, 100].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.07)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {model.stabilityArea ? (
            <polygon points={model.stabilityArea} fill={STABILITY_COLOR} fillOpacity="0.12" />
          ) : null}
          {model.stabilityLine ? (
            <polyline
              points={model.stabilityLine}
              fill="none"
              stroke={STABILITY_COLOR}
              strokeWidth="1.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {model.difficultyLine ? (
            <polyline
              points={model.difficultyLine}
              fill="none"
              stroke={DIFFICULTY_COLOR}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {model.points.map((point) => (
            <g key={point.key}>
              {point.stability != null ? (
                <line
                  x1={point.x}
                  x2={point.x}
                  y1={point.stability - 1.5}
                  y2={point.stability + 1.5}
                  stroke={STABILITY_COLOR}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              {point.difficulty != null ? (
                <line
                  x1={point.x}
                  x2={point.x}
                  y1={point.difficulty - 1.5}
                  y2={point.difficulty + 1.5}
                  stroke={DIFFICULTY_COLOR}
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
            </g>
          ))}
        </svg>
      </ChartAxes>
    </div>
  );
}
