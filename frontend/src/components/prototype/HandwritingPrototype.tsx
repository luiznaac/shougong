import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import type { SrsRating } from "../../api/types.ts";
import { PRACTICE_GRADES } from "../../lib/practiceGrades.ts";

/**
 * PROTOTYPE — throwaway, dev-only.
 *
 * Question: which layout best carries the ungraded self-check?
 * Three structurally different variants of the review screen's handwriting
 * step, switchable via `?variant=a|b|c` on `/review`. The drawing surface is
 * freehand here; the real step keeps hanzi-writer. Do not merge this file.
 *
 * A (Stage):  band + compact slot row + centered canvas.
 * B (Workbench): left rail with the word, vertical slot list, canvas on the right.
 * C (Deck):   tab strip + one large card + floating grade pill.
 */

const ITEM = {
  chars: ["服", "务", "员"],
  pinyin: "fú wù yuán",
  meaning: "garçom · atendente",
};

type Phase = "draw" | "peek" | "compare";
type Variant = "a" | "b" | "c";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];
type Drawings = Stroke[][];

const VARIANT_NAMES: Record<Variant, string> = {
  a: "Stage",
  b: "Workbench",
  c: "Deck",
};

function useSelfCheck() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("draw");
  const [drawings, setDrawings] = useState<Drawings>(() => ITEM.chars.map(() => []));
  const [selected, setSelected] = useState<SrsRating | null>(null);

  const stroke = useCallback(
    (s: Stroke) => {
      setDrawings((all) => all.map((char, i) => (i === idx ? [...char, s] : char)));
    },
    [idx],
  );

  const clear = useCallback(() => {
    setDrawings((all) => all.map((char, i) => (i === idx ? [] : char)));
  }, [idx]);

  const finish = useCallback(() => {
    if (idx < ITEM.chars.length - 1) {
      setIdx((i) => i + 1);
      setPhase("draw");
    } else {
      setPhase("compare");
    }
  }, [idx]);

  const peek = useCallback(() => setPhase("peek"), []);

  const continueAfterPeek = useCallback(() => {
    if (idx < ITEM.chars.length - 1) {
      setIdx((i) => i + 1);
      setPhase("draw");
    } else {
      setPhase("compare");
    }
  }, [idx]);

  const rollback = useCallback(() => {
    if (phase !== "draw") {
      if (selected) {
        setSelected(null);
        return;
      }
      setPhase("draw");
      if (idx > 0) {
        const prev = idx - 1;
        setIdx(prev);
        setDrawings((all) => all.map((char, i) => (i === prev ? [] : char)));
      }
      return;
    }
    if (idx > 0) {
      const prev = idx - 1;
      setIdx(prev);
      setDrawings((all) => all.map((char, i) => (i === prev ? [] : char)));
    }
  }, [phase, selected, idx]);

  const next = useCallback(() => {
    if (phase === "compare") {
      if (!selected) return;
      setSelected(null);
      setPhase("draw");
      setIdx(0);
      setDrawings(ITEM.chars.map(() => []));
      return;
    }
    finish();
  }, [phase, selected, finish]);

  return {
    idx,
    phase,
    drawings,
    selected,
    setSelected,
    stroke,
    clear,
    finish,
    peek,
    continueAfterPeek,
    rollback,
    next,
  };
}

type SelfCheck = ReturnType<typeof useSelfCheck>;

function GridLines({ strong = false }: { strong?: boolean }) {
  const color = strong ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.12)";
  return (
    <g stroke={color} strokeWidth="0.6" fill="none">
      <rect x="1" y="1" width="98" height="98" rx="2" />
      <line x1="50" y1="1" x2="50" y2="99" strokeDasharray="2 2" />
      <line x1="1" y1="50" x2="99" y2="50" strokeDasharray="2 2" />
      <line x1="1" y1="1" x2="99" y2="99" strokeDasharray="2 3" />
      <line x1="99" y1="1" x2="1" y2="99" strokeDasharray="2 3" />
    </g>
  );
}

function points(stroke: Stroke): string {
  return stroke.map((p) => `${p.x},${p.y}`).join(" ");
}

function StrokePaths({ strokes, current }: { strokes: Stroke[]; current?: Stroke | null }) {
  return (
    <>
      {strokes.map((stroke) => (
        <polyline
          key={`${stroke[0]?.x ?? 0}-${stroke[0]?.y ?? 0}-${stroke.length}`}
          points={points(stroke)}
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke="var(--color-accent-500)"
        />
      ))}
      {current && current.length > 1 && (
        <polyline
          points={points(current)}
          fill="none"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke="var(--color-accent-500)"
          strokeOpacity={0.8}
        />
      )}
    </>
  );
}

function DrawCanvas({
  strokes,
  onStroke,
  className = "",
  label = "Desenhe aqui",
}: {
  strokes: Stroke[];
  onStroke: (stroke: Stroke) => void;
  className?: string;
  label?: string;
}) {
  const [current, setCurrent] = useState<Stroke | null>(null);
  const drawing = useRef(false);

  const toPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const stop = () => {
    drawing.current = false;
  };

  return (
    <div className={`relative touch-none select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full rounded-2xl bg-slate-800/40 ring-1 ring-white/15"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          setCurrent([toPoint(event)]);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const p = toPoint(event);
          setCurrent((s) => (s ? [...s, p] : [p]));
        }}
        onPointerUp={(event) => {
          if (drawing.current) {
            const p = toPoint(event);
            const finished = current ? [...current, p] : [p];
            if (finished.length > 1) onStroke(finished);
          }
          stop();
          setCurrent(null);
        }}
        onPointerCancel={() => {
          stop();
          setCurrent(null);
        }}
      >
        <title>Área de desenho do caractere</title>
        <GridLines />
        <StrokePaths strokes={strokes} current={current} />
      </svg>
      {strokes.length === 0 && !current && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-slate-500">
          {label}
        </span>
      )}
    </div>
  );
}

function MiniDrawing({ strokes, className = "" }: { strokes: Stroke[]; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={`rounded-lg bg-slate-800/40 ring-1 ring-white/10 ${className}`}
    >
      <title>Traço do aprendiz</title>
      <GridLines />
      <StrokePaths strokes={strokes} />
    </svg>
  );
}

function ModelGlyph({ char, className = "" }: { char: string; className?: string }) {
  return (
    <div
      className={`relative grid place-items-center rounded-lg bg-slate-800/40 ring-1 ring-white/10 ${className}`}
    >
      <svg viewBox="0 0 100 100" aria-hidden className="absolute inset-0 h-full w-full">
        <title>Grade do modelo</title>
        <GridLines strong />
      </svg>
      <span className="relative font-hanzi text-5xl text-white">{char}</span>
    </div>
  );
}

function CompareCard({
  char,
  strokes,
  vertical = false,
  className = "",
}: {
  char: string;
  strokes: Stroke[];
  vertical?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-slate-900/70 p-2 ring-1 ring-white/10 ${className}`}>
      <div className={`grid gap-2 ${vertical ? "grid-rows-2" : "grid-cols-2"}`}>
        <figure>
          <figcaption className="pb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Seu traço
          </figcaption>
          <MiniDrawing strokes={strokes} className="aspect-square w-full" />
        </figure>
        <figure>
          <figcaption className="pb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Modelo
          </figcaption>
          <ModelGlyph char={char} className="aspect-square w-full" />
        </figure>
      </div>
    </div>
  );
}

function SlotChip({
  index,
  strokes,
  current,
  done,
  className = "",
}: {
  index: number;
  strokes: Stroke[];
  current: boolean;
  done: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-xl p-1 ring-1 ${
        current ? "bg-white/10 ring-2 ring-accent-500" : "bg-slate-900/60 ring-white/10"
      } ${className}`}
    >
      <span className="absolute -top-2 left-1.5 rounded-full bg-slate-950 px-1.5 text-[9px] font-semibold text-slate-400 tabular-nums">
        {index + 1}
      </span>
      {done ? (
        <MiniDrawing strokes={strokes} className="aspect-square w-full" />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-lg bg-slate-800/30 text-slate-600">
          ·
        </div>
      )}
    </div>
  );
}

function SlotRow({
  check,
  compare,
  vertical = false,
  size = "w-16",
}: {
  check: SelfCheck;
  compare: boolean;
  vertical?: boolean;
  size?: string;
}) {
  return (
    <div
      className={
        vertical
          ? "flex flex-col gap-3"
          : "flex items-start justify-center gap-3 overflow-x-auto pb-1"
      }
      aria-label="Progresso por caractere"
    >
      {ITEM.chars.map((char, i) => {
        if (compare) {
          return (
            <CompareCard
              key={char}
              char={char}
              strokes={check.drawings[i]}
              vertical={vertical}
              className={vertical ? "w-full" : "w-36 shrink-0"}
            />
          );
        }
        return (
          <SlotChip
            key={char}
            index={i}
            strokes={check.drawings[i]}
            current={i === check.idx}
            done={i < check.idx}
            className={size}
          />
        );
      })}
    </div>
  );
}

const SEGMENTS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

function ProgressSegments() {
  return (
    <div className="flex gap-1" aria-hidden>
      {SEGMENTS.map((id, i) => (
        <span
          key={id}
          className={`h-1 flex-1 rounded-full ${i < 3 ? "bg-white/45" : "bg-white/10"}`}
        />
      ))}
    </div>
  );
}

function HandwritingToggle({ compact = false }: { compact?: boolean }) {
  return (
    <label
      className={`flex items-center gap-1.5 text-white/80 ${compact ? "text-[11px]" : "text-xs"}`}
    >
      <input type="checkbox" defaultChecked className="h-3.5 w-3.5 accent-accent-500" />
      Escrever à mão
    </label>
  );
}

function GradeButtons({
  selected,
  onSelect,
  compact = false,
}: {
  selected: SrsRating | null;
  onSelect: (rating: SrsRating) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {PRACTICE_GRADES.map((grade) => {
        const active = selected === grade.key;
        return (
          <button
            key={grade.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(grade.key)}
            className={`flex-1 rounded-xl border-l-4 font-semibold transition ${
              compact ? "px-2 py-2 text-xs" : "px-2 py-3 text-sm"
            } ${grade.barClass} ${
              active
                ? `${grade.fillClass} text-white ring-2 ring-white ring-offset-2 ring-offset-slate-950`
                : "bg-slate-900 text-white"
            } ${selected && !active ? "opacity-50" : ""}`}
          >
            {grade.label}
          </button>
        );
      })}
    </div>
  );
}

function StageDock({ check }: { check: SelfCheck }) {
  const canNext = check.phase !== "compare" || check.selected !== null;
  return (
    <div className="border-t border-white/10 bg-slate-950/95 px-3 py-3">
      {check.phase === "compare" ? (
        <GradeButtons selected={check.selected} onSelect={check.setSelected} />
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={check.phase === "peek" ? check.continueAfterPeek : check.peek}
            className="flex-1 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white ring-1 ring-white/15"
          >
            {check.phase === "peek" ? "Continuar" : "Revelar"}
          </button>
          {check.phase === "draw" && (
            <button
              type="button"
              onClick={check.finish}
              className="flex-1 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-900"
            >
              Concluir caractere (simulado)
            </button>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <button type="button" onClick={check.rollback} className="hover:text-slate-300">
          ↩ Voltar
        </button>
        {check.phase === "compare" && (
          <button
            type="button"
            onClick={check.next}
            disabled={!canNext}
            className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white disabled:opacity-30"
          >
            Próximo
          </button>
        )}
      </div>
    </div>
  );
}

function VariantStage({ check }: { check: SelfCheck }) {
  const comparing = check.phase === "compare";
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-200">
      <header className="bg-gradient-to-b from-rose-500 to-accent-600 px-5 pt-4 pb-5">
        <div className="flex items-center gap-3 text-xs">
          <button type="button" className="text-white/80 hover:text-white">
            ← Sair
          </button>
          <span className="rounded-full bg-slate-950/30 px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase ring-1 ring-white/20">
            Review
          </span>
          <HandwritingToggle compact />
          <div className="ml-auto flex items-center gap-3 text-white/85 tabular-nums">
            <span>✓ 3</span>
            <span>☰ 5</span>
            <span>👍 90%</span>
          </div>
        </div>
        <ProgressSegments />
        <div className="mt-4 flex flex-col items-center gap-2">
          <span className="rounded-full bg-slate-950/40 px-4 py-1.5 text-xl font-medium text-white">
            {ITEM.pinyin}
          </span>
          <p className="text-sm font-semibold text-white">{ITEM.meaning}</p>
        </div>
      </header>

      <div className="px-4 pt-3">
        <SlotRow check={check} compare={comparing} />
      </div>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-4">
        {check.phase === "draw" && (
          <>
            <div className="flex items-end gap-3">
              <DrawCanvas
                strokes={check.drawings[check.idx]}
                onStroke={check.stroke}
                className="aspect-square w-[min(82vw,320px)]"
              />
              <button
                type="button"
                onClick={check.clear}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/15"
              >
                Limpar
              </button>
            </div>
            <p className="max-w-xs text-center text-xs text-slate-500">
              Desenhe {ITEM.chars[check.idx]} de memória. “Revelar” mostra o modelo.
            </p>
          </>
        )}

        {check.phase === "peek" && (
          <>
            <CompareCard
              char={ITEM.chars[check.idx]}
              strokes={check.drawings[check.idx]}
              className="w-[min(88vw,340px)]"
            />
            <p className="max-w-xs text-center text-xs text-slate-500">
              Só o caractere atual. “Continuar” segue para o próximo.
            </p>
          </>
        )}

        {comparing && (
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-100">
              Compare seus traços com o modelo.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Escolha a nota que descreve o que você lembrou.
            </p>
          </div>
        )}
      </main>

      <StageDock check={check} />
    </div>
  );
}

function VariantWorkbench({ check }: { check: SelfCheck }) {
  const comparing = check.phase === "compare";
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-200 lg:flex-row">
      <aside className="border-b border-white/10 px-5 py-4 lg:w-72 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3">
          <button type="button" className="text-xs text-slate-400 hover:text-white">
            ← Sair
          </button>
          <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-accent-500 uppercase ring-1 ring-accent-500/40">
            Review
          </span>
          <span className="ml-auto text-[11px] text-slate-500 tabular-nums">3 ✓ · 5 ☰</span>
        </div>
        <p className="mt-5 text-2xl font-medium text-white">{ITEM.pinyin}</p>
        <p className="mt-1 text-sm font-semibold text-white">{ITEM.meaning}</p>
        <div className="mt-3">
          <HandwritingToggle />
        </div>
        <div className="mt-5 lg:mt-8">
          <p className="pb-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
            Caracteres
          </p>
          <SlotRow check={check} compare={comparing} vertical size="w-full" />
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-5 py-5">
          {check.phase === "draw" && (
            <>
              <div className="flex w-full max-w-md items-end gap-3">
                <DrawCanvas
                  strokes={check.drawings[check.idx]}
                  onStroke={check.stroke}
                  className="aspect-square flex-1"
                />
                <button
                  type="button"
                  onClick={check.clear}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/15"
                >
                  Limpar
                </button>
              </div>
              <p className="text-center text-xs text-slate-500">
                Caractere {check.idx + 1} de {ITEM.chars.length} · desenhe {ITEM.chars[check.idx]}{" "}
                de memória.
              </p>
            </>
          )}

          {check.phase === "peek" && (
            <CompareCard
              char={ITEM.chars[check.idx]}
              strokes={check.drawings[check.idx]}
              vertical
              className="w-full max-w-sm"
            />
          )}

          {comparing && (
            <div className="w-full max-w-md text-center">
              <p className="text-sm font-semibold text-slate-100">
                Compare seus traços com o modelo na lateral.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Escolha a nota que descreve o que você lembrou.
              </p>
            </div>
          )}
        </div>
        <StageDock check={check} />
      </main>
    </div>
  );
}

function VariantDeck({ check }: { check: SelfCheck }) {
  const comparing = check.phase === "compare";
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-950 text-slate-200">
      <div className="flex items-center gap-2 px-4 pt-4">
        <button type="button" className="text-xs text-slate-400 hover:text-white">
          ← Sair
        </button>
        <span className="ml-auto text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
          Review · {ITEM.pinyin}
        </span>
      </div>

      <div className="flex justify-center gap-2 px-4 pt-4">
        {ITEM.chars.map((char, i) => {
          const active = i === check.idx;
          const done = i < check.idx || comparing;
          return (
            <button
              key={char}
              type="button"
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                active
                  ? "bg-accent-500 text-white"
                  : done
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-slate-500 ring-1 ring-white/10"
              }`}
            >
              {done && !active ? "✓" : i + 1}
            </button>
          );
        })}
      </div>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-4">
        {check.phase === "draw" && (
          <div className="w-full max-w-sm rounded-[2rem] bg-slate-900 p-4 ring-1 ring-white/10">
            <div className="flex items-end gap-3">
              <DrawCanvas
                strokes={check.drawings[check.idx]}
                onStroke={check.stroke}
                className="aspect-square flex-1"
              />
              <button
                type="button"
                onClick={check.clear}
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/15"
              >
                Limpar
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              Desenhe {ITEM.chars[check.idx]} de memória.
            </p>
          </div>
        )}

        {check.phase === "peek" && (
          <CompareCard
            char={ITEM.chars[check.idx]}
            strokes={check.drawings[check.idx]}
            className="w-full max-w-sm"
          />
        )}

        {comparing && (
          <div className="w-full max-w-sm rounded-[2rem] bg-slate-900 p-4 ring-1 ring-white/10">
            <p className="pb-3 text-center text-sm font-semibold text-slate-100">
              Compare seus traços com o modelo.
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ITEM.chars.map((char, i) => (
                <CompareCard
                  key={char}
                  char={char}
                  strokes={check.drawings[i]}
                  className="w-36 shrink-0"
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {check.phase === "compare" ? (
        <div className="px-4 pb-20">
          <GradeButtons selected={check.selected} onSelect={check.setSelected} />
          <button
            type="button"
            onClick={check.next}
            disabled={!check.selected}
            className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-900 disabled:opacity-30"
          >
            Próximo
          </button>
        </div>
      ) : (
        <div className="flex gap-2 px-4 pb-20">
          <button
            type="button"
            onClick={check.phase === "peek" ? check.continueAfterPeek : check.peek}
            className="flex-1 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white ring-1 ring-white/15"
          >
            {check.phase === "peek" ? "Continuar" : "Revelar"}
          </button>
          {check.phase === "draw" && (
            <button
              type="button"
              onClick={check.finish}
              className="flex-1 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-900"
            >
              Concluir (simulado)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PrototypeSwitcher({
  variant,
  onChange,
}: {
  variant: Variant;
  onChange: (next: Variant) => void;
}) {
  const order: Variant[] = ["a", "b", "c"];
  const step = (delta: number) => {
    const at = order.indexOf(variant);
    onChange(order[(at + delta + order.length) % order.length]);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable]")) return;
      event.preventDefault();
      step(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-900 shadow-2xl ring-1 ring-black/20">
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Variante anterior"
        className="rounded-full px-2 py-1 text-sm hover:bg-black/10"
      >
        ←
      </button>
      <span className="px-1 text-xs font-semibold">
        {variant.toUpperCase()} ({VARIANT_NAMES[variant]})
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Próxima variante"
        className="rounded-full px-2 py-1 text-sm hover:bg-black/10"
      >
        →
      </button>
    </div>
  );
}

export function HandwritingPrototype() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get("variant") ?? "a").toLowerCase();
  const variant: Variant = raw === "b" || raw === "c" ? raw : "a";
  const check = useSelfCheck();

  const change = (next: Variant) => {
    const updated = new URLSearchParams(params);
    updated.set("variant", next);
    setParams(updated, { replace: true });
  };

  return (
    <>
      {variant === "a" && <VariantStage check={check} />}
      {variant === "b" && <VariantWorkbench check={check} />}
      {variant === "c" && <VariantDeck check={check} />}
      <PrototypeSwitcher variant={variant} onChange={change} />
    </>
  );
}
