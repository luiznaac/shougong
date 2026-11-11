// Throwaway prototype (wayfinder #111, palette validation). One page, one row per
// candidate palette, so the four notes can be compared without switching
// variants. The last column previews the selected state (Bom with the white
// ring) because the ring is the only cue that has to survive every palette.

import { PALETTES } from "../palettes.ts";
import { GRADES } from "../practiceData.ts";

function GradeSample({
  tone,
  index,
  selected = false,
}: { tone: string; index: number; selected?: boolean }) {
  const grade = GRADES[index];
  return (
    <div
      className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl font-semibold ${tone} ${
        selected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""
      }`}
    >
      <span className="flex items-center gap-2 text-sm">
        {grade.label}
        <span className="rounded bg-black/25 px-1.5 text-[10px] font-normal">{grade.hotkey}</span>
      </span>
      <span className="text-[10px] font-normal opacity-70">{grade.hint}</span>
    </div>
  );
}

export function PaletteTable() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          Paletas de nota — comparação
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Quatro notas, quatro decisões de cor
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Todas as linhas usam o mesmo tamanho, o mesmo texto e o mesmo estado (habilitado). A
          última coluna mostra a nota selecionada, que é o único sinal que precisa sobreviver em
          qualquer paleta. A linha “Atual” é o que está em produção hoje.
        </p>

        <div className="mt-8 grid grid-cols-[260px_repeat(4,1fr)_1fr] items-center gap-x-3 gap-y-2 text-[10px] tracking-widest text-slate-500 uppercase">
          <span>Paleta</span>
          <span>Errei · 1</span>
          <span>Difícil · 2</span>
          <span>Bom · 3</span>
          <span>Fácil · 4</span>
          <span>Bom selecionado</span>
        </div>

        <div className="mt-2 divide-y divide-white/10 border-t border-white/10">
          {PALETTES.map((palette) => (
            <div
              key={palette.id}
              className="grid grid-cols-[260px_repeat(4,1fr)_1fr] items-center gap-3 py-4"
            >
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">{palette.name}</h2>
                  {palette.recommended && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-emerald-300 uppercase ring-1 ring-emerald-400/30">
                      recomendada
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{palette.note}</p>
              </div>
              {palette.tone.map((tone, i) => (
                <GradeSample key={`${palette.id}-${i}`} tone={tone} index={i} />
              ))}
              <GradeSample tone={palette.tone[2]} index={2} selected />
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-xs text-slate-500">
          Fora da tabela, o resto do dock continua igual: rollback, legenda de teclado e o botão
          “Próximo” em cerise. Escolha uma linha e eu aplico na variante H/I e registro no mapa.
        </p>
      </div>
    </div>
  );
}
