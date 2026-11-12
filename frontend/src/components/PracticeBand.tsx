import type { SrsRating, StudyItem } from "../api/types.ts";
import { TOLERANCE_PRESETS } from "../lib/localSettings.ts";
import { gradeOf } from "../lib/practiceGrades.ts";
import type { QuizPhase } from "../lib/quizPractice.ts";
import { STAGE_TOP } from "../lib/safeArea.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";
import { FlipCards } from "./FlipCards.tsx";
import { Pinyin } from "./Pinyin.tsx";
import { SrsIntactChip } from "./SrsIntactChip.tsx";
import { StrokePlayer } from "./StrokePlayer.tsx";

/** One segment per queue item, coloured by the grade it received. */
function ProgressSegments({
  count,
  grades,
  className = "",
}: {
  count: number;
  grades: (SrsRating | null)[];
  className?: string;
}) {
  return (
    <div className={`flex gap-1 ${className}`} aria-label="Progresso da sessão">
      {Array.from({ length: count }, (_, position) => ({ position })).map(({ position }) => {
        const grade = grades[position];
        const tone = grade
          ? gradeOf(grade).fillClass
          : position <= grades.length
            ? "bg-white/45"
            : "bg-white/10";
        return <span key={`segment-${position}`} className={`h-1 flex-1 rounded-full ${tone}`} />;
      })}
    </div>
  );
}

/**
 * The practice stage's coloured subject band: the header row, session
 * progress, tone-coloured pinyin, the one glyph slot and the meaning. The
 * glyph renders once per phase — the stroke player in info, hidden cards in
 * prompt, and the answer cards in revealed with an in-place player swap.
 */
export function PracticeBand({
  presentation,
  item,
  title,
  band,
  practice,
  phase,
  progress,
  playerOn,
  onTogglePlayer,
  canRollback,
  onRollback,
  onExit,
  handwritingEnabled,
  onHandwritingEnabledChange,
  tolerancePercent,
  onToleranceChange,
}: {
  presentation: Presentation;
  item: StudyItem;
  title: string;
  band: string;
  practice: boolean;
  phase: QuizPhase;
  progress: {
    itemCount: number;
    grades: (SrsRating | null)[];
    done: number;
    remaining: number;
    accuracy: number;
    showAccuracy: boolean;
  };
  playerOn: boolean;
  onTogglePlayer: () => void;
  canRollback: boolean;
  onRollback: () => void;
  onExit: () => void;
  handwritingEnabled: boolean;
  onHandwritingEnabledChange: (on: boolean) => void;
  tolerancePercent: number;
  onToleranceChange: (percent: number) => void;
}) {
  const mobile = presentation === "mobile";
  const chars = [...item.entry.simplified];
  const playerSize = mobile ? 150 : 175;
  const showPlayer = phase === "info" || (phase === "revealed" && playerOn);

  const handwriting = (
    <div
      className={`flex items-center gap-1.5 ${mobile ? "text-[11px]" : "text-xs"} text-white/80`}
    >
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={handwritingEnabled}
          onChange={(event) => onHandwritingEnabledChange(event.target.checked)}
          className="h-3.5 w-3.5 accent-accent-500"
        />
        Escrever à mão
      </label>
      {handwritingEnabled && (
        <select
          value={tolerancePercent}
          onChange={(event) => onToleranceChange(Number(event.target.value))}
          title="Tolerância de erros"
          className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/90"
        >
          {TOLERANCE_PRESETS.map((preset) => (
            <option key={preset} value={preset} className="text-slate-900">
              {preset}%
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <section
      className={`relative bg-gradient-to-b ${band} ${mobile ? "px-4 pb-6" : "px-7 pt-5 pb-7"}`}
      style={mobile ? { paddingTop: STAGE_TOP } : undefined}
    >
      <div className={`flex items-center gap-3 ${mobile ? "text-xs" : "text-sm"}`}>
        <button
          type="button"
          onClick={onExit}
          className="text-white/80 hover:text-white"
          title="Sair (Esc)"
        >
          ← Sair
        </button>
        <span
          className={`rounded-full bg-slate-950/30 font-semibold tracking-widest uppercase ring-1 ring-white/20 ${
            mobile ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
          }`}
        >
          {title}
        </span>
        {practice && <SrsIntactChip />}
        {!mobile && handwriting}
        <div
          className={`ml-auto flex items-center gap-4 text-white/85 tabular-nums ${
            mobile ? "text-[10px]" : "text-xs"
          }`}
          aria-label="Progresso da sessão"
        >
          <span title="Concluídos">✓ {progress.done}</span>
          <span title="Restantes">☰ {Math.max(0, progress.remaining)}</span>
          {progress.showAccuracy && <span title="Acertos">👍 {progress.accuracy}%</span>}
        </div>
        {mobile && (
          <button
            type="button"
            onClick={onRollback}
            disabled={!canRollback}
            aria-label="Rollback"
            title="Desfazer (Backspace)"
            className="rounded-md px-1 text-sm text-white/80 disabled:opacity-30"
          >
            ↩
          </button>
        )}
      </div>

      <ProgressSegments count={progress.itemCount} grades={progress.grades} className="mt-3" />

      <div className={`flex flex-col items-center ${mobile ? "mt-4 gap-2" : "mt-5 gap-3"}`}>
        <div className="rounded-full bg-slate-950/45 px-5 py-1.5 backdrop-blur-sm">
          <Pinyin
            value={item.entry.pinyin}
            className={mobile ? "text-lg font-medium" : "text-2xl font-medium sm:text-3xl"}
          />
        </div>

        {showPlayer ? (
          <StrokePlayer key={item.id} word={item.entry.simplified} sizePx={playerSize} />
        ) : (
          <FlipCards chars={chars} hidden={phase === "prompt"} available={mobile ? 300 : 430} />
        )}

        <p
          className={
            mobile
              ? "text-center text-sm font-semibold text-white"
              : "max-w-xl text-center text-lg font-semibold text-white drop-shadow"
          }
        >
          {item.entry.definitions.slice(0, mobile ? 2 : 3).join(" · ")}
        </p>

        {phase === "revealed" && (
          <button
            type="button"
            onClick={onTogglePlayer}
            className="rounded-full bg-slate-950/35 px-3 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/20 hover:bg-slate-950/55"
          >
            {playerOn ? "← Cartões" : "Ver traços →"}
          </button>
        )}

        {mobile && handwriting}
      </div>
    </section>
  );
}
