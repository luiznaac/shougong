// Throwaway palette catalogue (wayfinder #111, validation pass). One row per
// candidate grade palette so they can be compared side by side without
// switching variants. Every class string is literal so Tailwind emits it.

export interface GradePaletteDef {
  id: string;
  name: string;
  note: string;
  recommended?: boolean;
  tone: [string, string, string, string];
  /** what the chosen note looks like when the palette is neutral until picked */
  selectedTone?: string;
}

export const PALETTES: GradePaletteDef[] = [
  {
    id: "atual",
    name: "Atual (Tailwind)",
    note: "O que existe hoje: rosa, âmbar, esmeralda e azul do Tailwind. Nenhum deles é token do shell.",
    tone: [
      "bg-rose-600 text-white",
      "bg-amber-600 text-white",
      "bg-emerald-600 text-white",
      "bg-sky-600 text-white",
    ],
  },
  {
    id: "srs-solido",
    name: "SRS sólido",
    note: "Os quatro estágios do SRS como preenchimento. A cor é o destino do cartão e bate com os chips de estado do painel e da página do item.",
    recommended: true,
    tone: [
      "bg-srs-apprentice text-white",
      "bg-srs-guru text-white",
      "bg-srs-master text-white",
      "bg-srs-enlightened text-white",
    ],
  },
  {
    id: "srs-tintado",
    name: "SRS tintado",
    note: "A mesma rampa em tint 25% com anel interno: o dock fica mais silencioso, mas o matiz perde força em telas escuras.",
    tone: [
      "bg-srs-apprentice/25 text-white ring-1 ring-srs-apprentice/45 ring-inset",
      "bg-srs-guru/25 text-white ring-1 ring-srs-guru/45 ring-inset",
      "bg-srs-master/25 text-white ring-1 ring-srs-master/45 ring-inset",
      "bg-srs-enlightened/25 text-white ring-1 ring-srs-enlightened/45 ring-inset",
    ],
  },
  {
    id: "srs-contorno",
    name: "SRS contorno",
    note: "Fundo slate-900, rótulo branco e a matiz só na borda: o mais discreto dos três SRS, e o que menos briga com o CTA.",
    tone: [
      "bg-slate-900 text-white ring-1 ring-srs-apprentice/70 ring-inset",
      "bg-slate-900 text-white ring-1 ring-srs-guru/70 ring-inset",
      "bg-slate-900 text-white ring-1 ring-srs-master/70 ring-inset",
      "bg-slate-900 text-white ring-1 ring-srs-enlightened/70 ring-inset",
    ],
  },
  {
    id: "cerise-slate",
    name: "Cerise + slate",
    note: "Só cores do shell: cerise cheio, cerise em tint, quase branco, branco com anel sky. Calmo, mas bom e fácil ficam próximos.",
    tone: [
      "bg-accent-600 text-white",
      "bg-accent-500/30 text-white ring-1 ring-accent-400/50 ring-inset",
      "bg-slate-100 text-slate-900",
      "bg-white text-slate-900 ring-1 ring-sky-400/60 ring-inset",
    ],
  },
  {
    id: "cerise-rampa",
    name: "Rampa cerise",
    note: "Uma matiz, peso decrescente. Coerente, mas os acertos ficam apagados e as notas se confundem com o botão secundário.",
    tone: [
      "bg-accent-600 text-white",
      "bg-accent-600/65 text-white",
      "bg-accent-600/35 text-accent-50",
      "bg-accent-600/15 text-accent-200 ring-1 ring-accent-500/30 ring-inset",
    ],
  },
  {
    id: "tons",
    name: "Tons do pinyin",
    note: "As quatro cores de tom já definidas no shell (1→4). Bonitas e presentes, mas já têm dono: são a legenda de tom do pinyin.",
    tone: [
      "bg-tone-1 text-slate-950",
      "bg-tone-4 text-slate-950",
      "bg-tone-3 text-slate-950",
      "bg-tone-2 text-slate-950",
    ],
  },
  {
    id: "slate-peso",
    name: "Peso slate",
    note: "Só luminância, nenhuma matiz. O dock desaparece na moldura, mas a ordem 1–4 passa a depender só da posição.",
    tone: [
      "bg-slate-700 text-white",
      "bg-slate-600 text-white",
      "bg-slate-200 text-slate-900",
      "bg-white text-slate-900",
    ],
  },
  {
    id: "duotone",
    name: "Duotone",
    note: "Dois pólos (cerise ← → sky) com dois passos neutros no meio: quente para erro, frio para acerto.",
    tone: [
      "bg-accent-600 text-white",
      "bg-accent-500/30 text-white ring-1 ring-accent-400/50 ring-inset",
      "bg-slate-200 text-slate-900",
      "bg-tone-3 text-slate-950",
    ],
  },
  {
    id: "neutro-escolha",
    name: "Neutro até escolher",
    note: "As quatro notas são teclas neutras; a cor só aparece na nota escolhida, no matiz do estágio de destino. Zero ruído antes da decisão.",
    tone: [
      "bg-slate-800 text-slate-200",
      "bg-slate-800 text-slate-200",
      "bg-slate-800 text-slate-200",
      "bg-slate-800 text-slate-200",
    ],
    selectedTone: "bg-srs-master text-white",
  },
  {
    id: "fantasma",
    name: "Teclas fantasma",
    note: "Sem preenchimento: só contorno e rótulo, como um teclado. A nota escolhida vira cerise sólido. O mais silencioso de todos.",
    tone: [
      "bg-transparent text-slate-300 ring-1 ring-white/20",
      "bg-transparent text-slate-300 ring-1 ring-white/20",
      "bg-transparent text-slate-300 ring-1 ring-white/20",
      "bg-transparent text-slate-300 ring-1 ring-white/20",
    ],
    selectedTone: "bg-accent-500 text-white",
  },
  {
    id: "barra",
    name: "Barra de cor (adotada)",
    note: "Corpo slate com barra de 4px na cor do estágio; ao escolher, o botão inteiro preenche com essa cor. Mantém o significado sem pintar o dock inteiro.",
    recommended: true,
    tone: [
      "bg-slate-900 text-white border-l-4 border-srs-apprentice",
      "bg-slate-900 text-white border-l-4 border-srs-guru",
      "bg-slate-900 text-white border-l-4 border-srs-master",
      "bg-slate-900 text-white border-l-4 border-srs-enlightened",
    ],
    selectedTone: "bg-srs-master text-white",
  },
];
