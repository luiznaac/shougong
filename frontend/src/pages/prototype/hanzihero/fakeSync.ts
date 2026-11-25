// PROTOTYPE fixtures — in-memory only, no backend. The shapes mirror the sync
// contract sketched in issue #197 (created / already queued / unmatched, plus
// per-row candidates). Fixtures are deliberately small: the question is layout,
// not volume.

export type SyncScenario =
  | "desconectado"
  | "conectado"
  | "expirado"
  | "sincronizando"
  | "resultado";

export const SCENARIOS: { key: SyncScenario; label: string }[] = [
  { key: "desconectado", label: "desconectado" },
  { key: "conectado", label: "conectado" },
  { key: "expirado", label: "sessão expirada" },
  { key: "sincronizando", label: "sincronizando" },
  { key: "resultado", label: "resultado" },
];

export interface SyncCandidate {
  id: number;
  pinyin: string;
  definitions: string[];
}

export interface SyncRow {
  id: number;
  hanzi: string;
  pinyin: string;
  status: "created" | "queued" | "unmatched";
  detail: string | null;
  candidates: SyncCandidate[];
}

export interface RunCounts {
  created: number;
  queued: number;
  unmatched: number;
}

export const ACCOUNT = {
  handle: "luiznaac",
  connectedAt: "21 nov 2026",
  lastSyncAt: "hoje, 09:12",
};

export const SYNC_ROWS: SyncRow[] = [
  { id: 1, hanzi: "学习", pinyin: "xue2 xi2", status: "created", detail: null, candidates: [] },
  { id: 2, hanzi: "你好", pinyin: "ni3 hao3", status: "created", detail: null, candidates: [] },
  { id: 3, hanzi: "朋友", pinyin: "peng2 you3", status: "created", detail: null, candidates: [] },
  { id: 4, hanzi: "觉得", pinyin: "jue2 de5", status: "created", detail: null, candidates: [] },
  { id: 5, hanzi: "已经", pinyin: "yi3 jing1", status: "created", detail: null, candidates: [] },
  { id: 6, hanzi: "学校", pinyin: "xue2 xiao4", status: "created", detail: null, candidates: [] },
  { id: 7, hanzi: "帮助", pinyin: "bang1 zhu4", status: "created", detail: null, candidates: [] },
  { id: 8, hanzi: "咖啡", pinyin: "ka1 fei1", status: "created", detail: null, candidates: [] },
  { id: 9, hanzi: "时间", pinyin: "shi2 jian1", status: "queued", detail: null, candidates: [] },
  { id: 10, hanzi: "工作", pinyin: "gong1 zuo4", status: "queued", detail: null, candidates: [] },
  { id: 11, hanzi: "说话", pinyin: "shuo1 hua4", status: "queued", detail: null, candidates: [] },
  {
    id: 12,
    hanzi: "干",
    pinyin: "gan4",
    status: "unmatched",
    detail: "Hanzi encontrado, mas nenhum item com o pinyin gan4.",
    candidates: [{ id: 1201, pinyin: "gan1", definitions: ["secar", "fazer"] }],
  },
  {
    id: 13,
    hanzi: "着",
    pinyin: "zhe5",
    status: "unmatched",
    detail: "Tom neutro não encontrado para este hanzi.",
    candidates: [
      { id: 1301, pinyin: "zhao2", definitions: ["peça de xadrez", "movimento"] },
      { id: 1302, pinyin: "zhuo2", definitions: ["vestir", "tocar"] },
    ],
  },
  {
    id: 14,
    hanzi: "哪儿",
    pinyin: "na3r",
    status: "unmatched",
    detail: "Pinyin na3r não corresponde a nenhuma leitura do dicionário.",
    candidates: [{ id: 1401, pinyin: "na3 er2", definitions: ["onde"] }],
  },
];

export function countRows(rows: SyncRow[]): RunCounts {
  return {
    created: rows.filter((row) => row.status === "created").length,
    queued: rows.filter((row) => row.status === "queued").length,
    unmatched: rows.filter((row) => row.status === "unmatched").length,
  };
}

export const RUN_COUNTS = countRows(SYNC_ROWS);

export const RUN_TOTAL = SYNC_ROWS.length;
export const RUN_PROGRESS = 9;

export interface SyncHistoryEntry {
  id: string;
  at: string;
  counts: RunCounts;
}

export const HISTORY: SyncHistoryEntry[] = [
  { id: "r3", at: ACCOUNT.lastSyncAt, counts: RUN_COUNTS },
  { id: "r2", at: "20 nov, 18:40", counts: { created: 12, queued: 40, unmatched: 0 } },
  { id: "r1", at: "19 nov, 21:05", counts: { created: 291, queued: 0, unmatched: 2 } },
];

export const STATUS_LABEL: Record<SyncRow["status"], string> = {
  created: "criada",
  queued: "já na fila",
  unmatched: "sem correspondência",
};

export interface SyncDemoProps {
  scenario: SyncScenario;
  onConnect: () => void;
  onSync: () => void;
  onReconnect: () => void;
}
