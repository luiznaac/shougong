import { PageHeader } from "../components/PageHeader.tsx";
import { Panel } from "../components/Panel.tsx";
import {
  TOLERANCE_PRESETS,
  allowedMistakes,
  useHandwritingEnabled,
  useHandwritingTolerance,
} from "../lib/localSettings.ts";

const SAMPLE_STROKES = 6;

function mistakeCopy(allowed: number): string {
  const noun = allowed === 1 ? "erro permitido" : "erros permitidos";
  return `${allowed} ${noun} em um caractere de ${SAMPLE_STROKES} traços.`;
}

/**
 * Ajustes: the per-browser handwriting preferences, composed from the shared
 * header and panel. The toggle and tolerance persist locally through
 * `lib/localSettings.ts`, so a reload keeps them and the quiz reads the same
 * values. No server involvement.
 */
export function Ajustes() {
  const [enabled, setEnabled] = useHandwritingEnabled();
  const [tolerancePercent, setTolerancePercent] = useHandwritingTolerance();

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Preferências" title="Ajustes" />

      <Panel title="Escrita à mão">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <label htmlFor="handwriting-enabled" className="text-sm font-medium text-slate-200">
                Checagem de escrita à mão
              </label>
              <p className="mt-1 text-xs text-slate-500">
                No quiz, escreva o caractere de memória em vez de só virar o cartão. Melhor com
                toque; com mouse, a virada simples costuma ser mais rápida.
              </p>
            </div>
            <input
              id="handwriting-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-accent-500"
            />
          </div>

          <div>
            <label htmlFor="handwriting-tolerance" className="text-sm font-medium text-slate-200">
              Tolerância de erros
            </label>
            <select
              id="handwriting-tolerance"
              value={tolerancePercent}
              onChange={(event) => setTolerancePercent(Number(event.target.value))}
              disabled={!enabled}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
            >
              {TOLERANCE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset === 0 ? "Sem tolerância (0%)" : `${preset}%`}
                </option>
              ))}
            </select>
            {enabled ? (
              <>
                <p className="mt-1 text-xs text-slate-500">
                  {mistakeCopy(allowedMistakes(SAMPLE_STROKES, tolerancePercent))}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  A tolerância cresce com o número de traços.
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                A checagem está desligada neste navegador.
              </p>
            )}
          </div>

          <p className="text-xs text-slate-500">
            Estas preferências ficam salvas neste navegador — não são sincronizadas entre
            dispositivos.
          </p>
        </div>
      </Panel>
    </div>
  );
}
