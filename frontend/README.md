# shougong-fe

Frontend para o SRS de escrita à mão de chinês [`shougong`](../shougong). SPA em
React + Vite + TypeScript + Tailwind v4, consumindo a API HTTP do backend.

Estética inspirada em WaniKani (estágios de SRS, forecast) + HanziHero (pinyin com
tom colorido, tipografia Noto Sans SC).

## Pré-requisitos

- **Node.js 20+** (não estava instalado na máquina quando o projeto foi criado —
  instale via `winget install OpenJS.NodeJS.LTS` ou <https://nodejs.org>).
- O backend `shougong` rodando (`uv run poe run` → `http://localhost:8080`).

## Rodar em dev

```bash
npm install
npm run dev
```

Abre em `http://localhost:5273`. As chamadas para `/api/*` são _proxied_ para
`http://localhost:8080` (config em `vite.config.ts`, ajustável por
`VITE_API_TARGET`). Assim não precisa mexer em CORS no backend.

## Build

```bash
npm run build      # gera dist/ com base path /shougong/ (para o reverse proxy)
npm run preview
```

Para buildar na raiz (`/`) em vez de `/shougong/`: `VITE_BASE=/ npm run build`.

## Telas

| Rota          | O quê                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| `/`           | Painel estilo HanziHero: 2 botões, SRS distribution, upcoming reviews, tiles |
| `/lesson`     | Fluxo de lição (tela cheia) — itens em `learning`                       |
| `/review`     | Loop de review (tela cheia) — itens em `review` que estão _due_         |
| `/items/:id`  | Página do item: hanzi, pinyin, FSRS, gráfico de trajetória             |
| `/add`        | Busca no dicionário e adiciona itens à fila                             |

Os dois botões do painel: **esquerdo (azul)** = nº de itens em `learning` → `/lesson`;
**direito (vermelho)** = nº de itens em `review` e _due_ (ignora `learning`) → `/review`.

### Fluxo do review (invertido — treino de escrita)

1. A tela mostra **pinyin + significados**; o hanzi fica **escondido**.
2. Você escreve o caractere à mão no papel.
3. `Espaço` / `Enter` → revela o hanzi.
4. Autoavalie: `1` Errei · `2` Difícil · `3` Bom · `4` Fácil → manda o grade pro
   FSRS (`POST /study-items/{id}/reviews`). `again` conta como erro na precisão.
5. `Esc` sai a qualquer momento.

### Fluxo da lição

Igual ao review, mas cada item começa com uma tela de **apresentação** (hanzi +
pinyin + significados visíveis) antes do quiz. `Espaço` avança da apresentação
para o quiz. Depois do quiz o item vira `review` normal via FSRS.

Se um item não estiver disponível quando enviado (backend responde `409`), ele é
pulado com um aviso.

## Notas de arquitetura

- `src/api/` — cliente HTTP tipado + hooks TanStack Query. Os tipos em `types.ts`
  espelham `httpapi/schema.py` do backend.
- `src/lib/pinyin.ts` — converte pinyin numerado (`zhi1 dao4`) para acentuado e
  expõe o tom de cada sílaba para colorir.
- `src/lib/srs.ts` — o backend só guarda FSRS cru (state + stability). O ladder de
  níveis estilo HanziHero é derivado **no cliente** a partir do `stability` (dias):
  Novice I/II (1d, 4d), Apprentice I/II (1sem, 2sem), Journeyman I/II (1mês, 2meses),
  Expert I/II/III (4, 8, 12 meses), Master (>1 ano). O gráfico do painel agrupa em
  Novice/Apprentice/Journeyman/Expert/Master.
- `GET /study-items/{id}/history` — snapshots do card FSRS por review (novo no backend);
  a página do item mostra a trajetória de nível a partir daí.
- Mnemônicos, decomposição em componentes e níveis **não existem** no backend
  ainda — ficam para uma fase futura (nova tabela + campos).
