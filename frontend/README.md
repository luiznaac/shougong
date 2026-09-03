# shougong-fe

Frontend para o SRS de escrita à mão de chinês [`shougong`](../shougong). SPA em
React + Vite + TypeScript + Tailwind v4, consumindo a API HTTP do backend.

Estética inspirada no HanziHero (painel, bandas coloridas do quiz, pinyin com tom
colorido, Noto Sans SC), com o ladder de níveis de SRS agrupado à la WaniKani.

## Pré-requisitos

- **Node.js 20+** (não estava instalado na máquina quando o projeto foi criado —
  instale via `winget install OpenJS.NodeJS.LTS` ou <https://nodejs.org>).
- O backend `shougong` rodando (`uv run poe run` → `http://localhost:8080`).

## Rodar em dev

```bash
npm install
npm run dev
```

Abre em `http://localhost:5273` (ou a próxima porta livre). As chamadas para
`/api/*` são _proxied_ para `http://localhost:8080` (config em `vite.config.ts`,
ajustável por `VITE_API_TARGET`). Assim não precisa mexer em CORS no backend.

> No PowerShell, se `npm` for bloqueado pela _execution policy_
> (`npm.ps1 cannot be loaded`), use `npm.cmd install` / `npm.cmd run dev`, ou
> libere com `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

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
| `/lesson`     | Quiz de lição (tela cheia) — itens em `learning`                        |
| `/review`     | Quiz de review (tela cheia) — itens em `review` que estão _due_         |
| `/items/:id`  | Página do item: hanzi, pinyin, FSRS, gráfico de trajetória              |
| `/add`        | Busca no dicionário e adiciona itens à fila                             |

Os dois botões do painel: **esquerdo (azul)** = nº de itens em `learning` → `/lesson`;
**direito (vermelho)** = nº de itens em `review` e _due_ (ignora `learning`) → `/review`.

### Quiz (review e lição)

Tela cheia, estilo HanziHero: banda colorida com o assunto (pinyin com tom
colorido numa pílula + os cards + significado), banda escura com a pergunta, e
uma toolbar embaixo com **Rollback** e **Próximo**.

O caractere aparece num **card por caractere** (palavras com N caracteres → N
cards). Os cards **viram** (flip 3D) para esconder/revelar — todos juntos.

**Review** (invertido — treino de escrita):

1. Banda mostra **pinyin + significado**; os cards estão virados no `?`.
2. Você escreve o caractere à mão no papel.
3. **Próximo** (`Espaço`/`Enter`) → os cards viram e revelam o hanzi.
4. Escolha `1` Errei · `2` Difícil · `3` Bom · `4` Fácil — isso só **seleciona**.
5. **Próximo** confirma e envia (`POST /study-items/{id}/reviews`); só habilita
   depois de uma nota escolhida. `again` conta como erro na precisão.
6. **Rollback** (`Backspace`/`z`) desfaz a nota selecionada; sem seleção, volta
   uma etapa (re-esconde o card). `Esc` sai.

**Lição**: cada item começa numa etapa de **apresentação** com os cards já
mostrando o hanzi; **Próximo** vira os cards para esconder e segue igual ao
review. Depois do quiz o item vira `review` normal via FSRS.

Se um item não estiver disponível quando enviado (backend responde `409`), ele é
pulado com um aviso.

## Notas de arquitetura

- `src/api/` — cliente HTTP tipado + hooks TanStack Query. Os tipos em `types.ts`
  espelham `httpapi/schema.py` do backend.
- `src/components/Quiz.tsx` — motor de tela cheia compartilhado por `/review` e
  `/lesson` (fases, flip, seleção de nota, Próximo/Rollback, atalhos).
- `src/components/Hanzi.tsx` — renderiza hanzi numa linha só, encolhendo a fonte
  para palavras com vários caracteres (usado fora do quiz — tiles, header, busca).
- `src/lib/pinyin.ts` — converte pinyin numerado (`zhi1 dao4`) para acentuado e
  expõe o tom de cada sílaba; `<Pinyin>` colore por tom (paleta em `index.css`,
  `--color-tone-*`), ou `coloured={false}` para texto liso.
- `src/lib/srs.ts` — o backend só guarda FSRS cru (state + stability). O ladder de
  níveis estilo HanziHero é derivado **no cliente** a partir do `stability` (dias):
  Novice I/II (1d, 4d), Apprentice I/II (1sem, 2sem), Journeyman I/II (1mês, 2meses),
  Expert I/II/III (4mo, 8mo, 1ano), Master (>1 ano). O gráfico do painel agrupa em
  Novice/Apprentice/Journeyman/Expert/Master.
- `GET /study-items/{id}/history` — snapshots do item por mudança de estado; a página do
  item plota estabilidade + dificuldade ao longo do tempo.
- `GET /study-items/history/learning-to-review` — a transição learning→review de cada item
  (paginado, `limit`/`offset`); o painel agrega por `created_at` num gráfico cumulativo de
  "Itens aprendidos". `src/api/client.ts` pagina isso em `listLearningToReviewHistory()`.
- Mnemônicos, decomposição em componentes e níveis **não existem** no backend
  ainda — ficam para uma fase futura (nova tabela + campos).
