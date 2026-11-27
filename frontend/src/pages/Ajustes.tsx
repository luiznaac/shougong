import { HanziHeroPanel } from "../components/HanziHeroPanel.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Panel } from "../components/Panel.tsx";
import { useAutoReveal, useHandwritingEnabled } from "../lib/localSettings.ts";

/**
 * Ajustes: the per-browser handwriting preferences, composed from the shared
 * header and panel. Both toggles persist locally through
 * `lib/localSettings.ts`, so a reload keeps them and the quiz reads the same
 * values. No server involvement.
 */
export function Ajustes() {
  const [enabled, setEnabled] = useHandwritingEnabled();
  const [autoReveal, setAutoReveal] = useAutoReveal();

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

          {!enabled && (
            <p className="text-xs text-slate-500">A checagem está desligada neste navegador.</p>
          )}

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <label htmlFor="auto-reveal-enabled" className="text-sm font-medium text-slate-200">
                Revelar automaticamente
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Terminado o último caractere, a comparação aparece sozinha. Desligado, você toca em
                “Revelar” para ver o modelo.
              </p>
            </div>
            <input
              id="auto-reveal-enabled"
              type="checkbox"
              checked={autoReveal}
              onChange={(event) => setAutoReveal(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-accent-500"
            />
          </div>

          <p className="text-xs text-slate-500">
            Estas preferências ficam salvas neste navegador — não são sincronizadas entre
            dispositivos.
          </p>
        </div>
      </Panel>

      <HanziHeroPanel />
    </div>
  );
}
