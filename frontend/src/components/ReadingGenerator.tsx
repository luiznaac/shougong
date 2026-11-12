import { useState } from "react";
import { useGenerateReading, useReadingModels } from "../api/queries.ts";
import type { ReadingFormat, SavedReadingText } from "../api/types.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";
import { Panel } from "./Panel.tsx";

const MODEL_STORAGE_KEY = "reading.model";

const EXTRA_WORDS_BOUNDS = { min: 0, max: 20, fallback: 2 } as const;
const ATTEMPTS_BOUNDS = { min: 1, max: 6, fallback: 3 } as const;

// A cleared number input reads back as "" → NaN; keep the request inside the
// backend's bounds so it never 422s.
function clamp(value: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

/**
 * The reading generator: one wrapping bar above the article on desktop and a
 * compact "Nova leitura" card below it on mobile. Format/model/extras/attempts/
 * topic and the remembered model choice behave the same on both widths.
 */
export function ReadingGenerator({
  presentation,
  onGenerated,
}: {
  presentation: Presentation;
  onGenerated: (reading: SavedReadingText) => void;
}) {
  const [format, setFormat] = useState<ReadingFormat>("paragraph");
  const [maxExtraWords, setMaxExtraWords] = useState<number>(EXTRA_WORDS_BOUNDS.fallback);
  const [maxAttempts, setMaxAttempts] = useState<number>(ATTEMPTS_BOUNDS.fallback);
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(MODEL_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);

  const generateMutation = useGenerateReading();
  const { data: models, isLoading: modelsLoading, error: modelsError } = useReadingModels();

  // Fall back to the first available model until the user picks one (or if the
  // remembered choice is no longer offered by the proxy).
  const chosenModel = model && models?.includes(model) ? model : (models?.[0] ?? null);

  const selectModel = (value: string) => {
    setModel(value);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, value);
    } catch {
      /* private mode / storage disabled — selection still works for this session */
    }
  };

  const generate = async () => {
    if (!chosenModel) return;
    setError(null);
    try {
      const saved = await generateMutation.mutateAsync({
        format,
        max_extra_words: clamp(
          maxExtraWords,
          EXTRA_WORDS_BOUNDS.min,
          EXTRA_WORDS_BOUNDS.max,
          EXTRA_WORDS_BOUNDS.fallback,
        ),
        max_attempts: clamp(
          maxAttempts,
          ATTEMPTS_BOUNDS.min,
          ATTEMPTS_BOUNDS.max,
          ATTEMPTS_BOUNDS.fallback,
        ),
        model: chosenModel,
        topic: topic.trim() || null,
      });
      onGenerated(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const mobile = presentation === "mobile";

  return (
    <Panel
      ariaLabel={mobile ? "Nova leitura" : "Gerador de leitura"}
      title={mobile ? "Nova leitura" : undefined}
    >
      <div className={mobile ? "grid grid-cols-2 gap-3" : "flex flex-wrap items-end gap-3"}>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Formato
          <select
            aria-label="Formato"
            value={format}
            onChange={(event) => setFormat(event.target.value as ReadingFormat)}
            className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
          >
            <option value="paragraph">Parágrafo</option>
            <option value="sentences">Frases soltas</option>
            <option value="dialogue">Diálogo</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Modelo de IA
          <select
            aria-label="Modelo de IA"
            value={chosenModel ?? ""}
            onChange={(event) => selectModel(event.target.value)}
            disabled={modelsLoading || !!modelsError || !models?.length}
            className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100 disabled:opacity-50"
          >
            {modelsLoading ? <option value="">Carregando…</option> : null}
            {modelsError ? <option value="">Erro ao carregar modelos</option> : null}
            {!modelsLoading && !modelsError && !models?.length ? (
              <option value="">Nenhum modelo disponível</option>
            ) : null}
            {(models ?? []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Palavras extras (máx.)
          <input
            aria-label="Palavras extras"
            type="number"
            min={EXTRA_WORDS_BOUNDS.min}
            max={EXTRA_WORDS_BOUNDS.max}
            value={maxExtraWords}
            onChange={(event) => setMaxExtraWords(Number(event.target.value))}
            className="w-24 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Tentativas (máx.)
          <input
            aria-label="Tentativas"
            type="number"
            min={ATTEMPTS_BOUNDS.min}
            max={ATTEMPTS_BOUNDS.max}
            value={maxAttempts}
            onChange={(event) => setMaxAttempts(Number(event.target.value))}
            className="w-24 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
          />
        </label>

        <label
          className={`flex flex-col gap-1 text-sm text-slate-400 ${
            mobile ? "col-span-2" : "min-w-48 flex-1"
          }`}
        >
          Tópico (opcional)
          <input
            aria-label="Tópico"
            type="text"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="em branco = tema sorteado"
            maxLength={200}
            className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
          />
        </label>

        <button
          type="button"
          onClick={generate}
          disabled={generateMutation.isPending || !chosenModel}
          className={`rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50 ${
            mobile ? "col-span-2 min-h-11" : ""
          }`}
        >
          {generateMutation.isPending ? "Gerando…" : "Gerar leitura"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-400">
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
