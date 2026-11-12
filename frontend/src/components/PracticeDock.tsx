import type { SrsRating } from "../api/types.ts";
import { PRACTICE_GRADES } from "../lib/practiceGrades.ts";
import { STAGE_BOTTOM, STAGE_HORIZONTAL_PADDING } from "../lib/safeArea.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";

function gradeTone(
  grade: (typeof PRACTICE_GRADES)[number],
  { revealed, selected, dim }: { revealed: boolean; selected: boolean; dim: boolean },
): string {
  if (!revealed) return "border-l-slate-700 bg-white/5 text-slate-500";
  if (selected) {
    return `${grade.fillClass} ${grade.barClass} text-white ring-2 ring-white ring-offset-2 ring-offset-slate-900`;
  }
  if (dim) return `bg-slate-900 text-slate-500 ${grade.barClass}`;
  return `bg-slate-900 text-white ${grade.barClass}`;
}

function KeyboardLegend() {
  return (
    <p className="hidden text-[11px] text-slate-500 lg:block">
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">1–4</kbd> avaliar
      <span className="mx-2">·</span>
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">⌫</kbd> desfazer
      <span className="mx-2">·</span>
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">⏎</kbd> continuar
      <span className="mx-2">·</span>
      <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-400">Esc</kbd> sair
    </p>
  );
}

/**
 * The practice stage's dock: the four note keys, rollback and advance. Desktop
 * keeps the tall keys with their SRS hint and a toolbar row; mobile renders one
 * row of 44px keys over a full-width advance, with the home-indicator
 * affordance under it. Rollback moves to the band's top bar on mobile.
 */
export function PracticeDock({
  presentation,
  revealed,
  selected,
  canRollback,
  canNext,
  submitting,
  nextLabel,
  onSelect,
  onRollback,
  onNext,
}: {
  presentation: Presentation;
  revealed: boolean;
  selected: SrsRating | null;
  canRollback: boolean;
  canNext: boolean;
  submitting: boolean;
  nextLabel: string;
  onSelect: (rating: SrsRating) => void;
  onRollback: () => void;
  onNext: () => void;
}) {
  const keys = (height: string, withHint: boolean) =>
    PRACTICE_GRADES.map((grade) => {
      const on = selected === grade.key;
      const dim = selected != null && !on;
      return (
        <button
          key={grade.key}
          type="button"
          aria-pressed={on}
          disabled={!revealed || submitting}
          onClick={() => onSelect(grade.key)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-l-4 font-semibold transition motion-reduce:transition-none ${height} ${gradeTone(
            grade,
            { revealed, selected: on, dim },
          )}`}
        >
          <span className="flex items-center gap-2 text-sm">
            {grade.label}
            <kbd className="rounded bg-black/25 px-1.5 text-[10px] font-normal">{grade.hotkey}</kbd>
          </span>
          {withHint && <span className="text-[10px] font-normal opacity-70">{grade.hint}</span>}
        </button>
      );
    });

  const advance = (placement: string) => (
    <button
      type="button"
      onClick={onNext}
      disabled={!canNext || submitting}
      title="Confirmar (Enter)"
      className={`rounded-xl bg-accent-500 font-semibold text-white transition hover:bg-accent-600 disabled:opacity-40 ${placement}`}
    >
      {nextLabel} →
    </button>
  );

  if (presentation === "mobile") {
    return (
      <footer
        className="border-t border-white/10 bg-slate-900/95 pt-2.5"
        style={{ paddingBottom: STAGE_BOTTOM, ...STAGE_HORIZONTAL_PADDING }}
      >
        <div className="flex gap-1.5">{keys("h-12", false)}</div>
        {advance("mt-1.5 h-11 w-full text-sm")}
        <div className="mx-auto mt-1.5 h-1 w-24 rounded-full bg-white/25" />
      </footer>
    );
  }

  return (
    <footer className="border-t border-white/10 bg-slate-900/70 px-6 py-3">
      <div className="grid grid-cols-4 gap-2.5">{keys("h-16", true)}</div>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={onRollback}
          disabled={!canRollback || submitting}
          aria-label="Rollback"
          title="Desfazer (Backspace)"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-30"
        >
          ↩ Rollback
        </button>
        <KeyboardLegend />
        {advance("ml-auto px-7 py-2.5 text-sm")}
      </div>
    </footer>
  );
}
