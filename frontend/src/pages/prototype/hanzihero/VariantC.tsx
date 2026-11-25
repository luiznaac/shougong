import { type FormEvent, type ReactNode, useState } from "react";
import { DataList, type DataListColumn } from "../../../components/DataList.tsx";
import { EmptyState } from "../../../components/EmptyState.tsx";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { Icon } from "../../../components/icons.tsx";
import {
  ACCOUNT,
  RUN_COUNTS,
  RUN_PROGRESS,
  RUN_TOTAL,
  STATUS_LABEL,
  SYNC_ROWS,
  type SyncDemoProps,
  type SyncRow,
} from "./fakeSync.ts";

// Variant C — "Mesa de trabalho": two panes side by side, the way Biblioteca's
// Add/Import already works. Left holds the connection and the one action; right
// is the last run as a filterable, always-visible table. Denser, data-first.

const PILL = {
  created: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
  queued: "bg-slate-500/15 text-slate-400 ring-slate-500/20",
  unmatched: "bg-amber-500/15 text-amber-300 ring-amber-500/20",
} as const;

const FILTERS = [
  { key: "all", label: "Todas", count: RUN_TOTAL },
  { key: "created", label: "Criadas", count: RUN_COUNTS.created },
  { key: "queued", label: "Já na fila", count: RUN_COUNTS.queued },
  { key: "unmatched", label: "Sem correspondência", count: RUN_COUNTS.unmatched },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-slate-900/40 p-5 ring-1 ring-white/10">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function StatusLine({ tone, children }: { tone: "ok" | "warn" | "off"; children: ReactNode }) {
  const dot = tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : "bg-slate-600";
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

function ConnectForm({ expired, onConnect }: { expired: boolean; onConnect: () => void }) {
  const [handle, setHandle] = useState(expired ? ACCOUNT.handle : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!handle.trim() || !password) {
      setError("Informe e-mail/usuário e senha.");
      return;
    }
    setError(null);
    onConnect();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {expired ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
          <Icon name="clock" size={14} className="mt-0.5 shrink-0" />
          <p>Sessão expirada. Entre de novo para sincronizar.</p>
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-slate-500">
          Entre com sua conta HanziHero. Nada é importado até você tocar em Sincronizar.
        </p>
      )}
      <label className="block">
        <span className="text-xs text-slate-500">E-mail ou usuário</span>
        <input
          type="text"
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          autoComplete="username"
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent-500"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Senha</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent-500"
        />
      </label>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="w-full rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
      >
        {expired ? "Reconectar" : "Conectar"}
      </button>
      <p className="text-[11px] text-slate-500">
        A senha não é guardada; só o cookie de sessão fica no shougong.
      </p>
    </form>
  );
}

function ConnectionPane({ scenario, onConnect, onSync, onReconnect }: SyncDemoProps) {
  const showForm = scenario === "desconectado" || scenario === "expirado";

  return (
    <Pane title="Conexão">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-100">HanziHero</p>
            {showForm ? null : (
              <StatusLine tone="ok">
                {scenario === "sincronizando" ? "sincronizando" : "conectado"}
              </StatusLine>
            )}
          </div>
          {showForm ? (
            <div className="mt-1">
              <StatusLine tone={scenario === "expirado" ? "warn" : "off"}>
                {scenario === "expirado" ? "sessão expirada" : "não conectado"}
              </StatusLine>
            </div>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {ACCOUNT.handle} · sessão desde {ACCOUNT.connectedAt}
            </p>
          )}
        </div>

        {showForm ? (
          <ConnectForm expired={scenario === "expirado"} onConnect={onConnect} />
        ) : (
          <>
            <dl className="rounded-lg bg-slate-950/50 px-3 py-2.5 ring-1 ring-white/5">
              <dt className="text-[10px] uppercase tracking-wide text-slate-500">
                Última sincronização
              </dt>
              <dd className="text-sm text-slate-200">{ACCOUNT.lastSyncAt}</dd>
            </dl>

            <ul className="space-y-1 text-[11px] text-slate-500">
              <li>Personagens, palavras e itens de dicionário.</li>
              <li>Itens pulados ficam de fora.</li>
              <li>Nada da sua fila é apagado ou alterado.</li>
            </ul>

            <button
              type="button"
              onClick={onSync}
              disabled={scenario === "sincronizando"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
            >
              {scenario === "sincronizando" ? (
                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              ) : null}
              {scenario === "sincronizando" ? "Sincronizando…" : "Sincronizar agora"}
            </button>
            <button
              type="button"
              onClick={onReconnect}
              className="w-full text-center text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              Reconectar conta
            </button>
          </>
        )}
      </div>
    </Pane>
  );
}

function StatusPill({ row }: { row: SyncRow }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${PILL[row.status]}`}
    >
      {STATUS_LABEL[row.status]}
    </span>
  );
}

function RowDetail({ row }: { row: SyncRow }) {
  if (row.status !== "unmatched") return <span className="text-slate-600">—</span>;
  return (
    <div className="space-y-1">
      <p className="text-slate-500">{row.detail}</p>
      <div className="flex flex-wrap gap-1.5">
        {row.candidates.map((candidate) => (
          <span
            key={candidate.id}
            className="rounded border border-white/10 bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-300"
          >
            #{candidate.id} {candidate.pinyin} — {candidate.definitions.join("; ")}
          </span>
        ))}
      </div>
    </div>
  );
}

function SyncTable({
  filter,
  onFilter,
}: { filter: FilterKey; onFilter: (key: FilterKey) => void }) {
  const rows = filter === "all" ? SYNC_ROWS : SYNC_ROWS.filter((row) => row.status === filter);

  const columns: DataListColumn<SyncRow>[] = [
    {
      key: "hanzi",
      label: "Hanzi",
      render: (row) => (
        <span className="font-hanzi text-base" lang="zh-Hans">
          {row.hanzi}
        </span>
      ),
    },
    {
      key: "pinyin",
      label: "Pinyin",
      render: (row) => <Pinyin value={row.pinyin} />,
    },
    { key: "status", label: "Status", render: (row) => <StatusPill row={row} /> },
    { key: "detail", label: "Detalhe", render: (row) => <RowDetail row={row} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilter(item.key)}
            aria-pressed={filter === item.key}
            className={[
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              filter === item.key
                ? "bg-white/10 text-slate-100"
                : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>
      <DataList
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        label="Resultado da sincronização"
      />
    </div>
  );
}

function ResultPane({ scenario }: { scenario: SyncDemoProps["scenario"] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const percent = Math.round((RUN_PROGRESS / RUN_TOTAL) * 100);
  const running = scenario === "sincronizando";

  return (
    <Pane title="Última sincronização">
      {scenario === "desconectado" ? (
        <EmptyState
          icon="layers"
          title="Nenhuma sincronização ainda"
          description="Conecte sua conta e toque em Sincronizar para ver o resultado aqui."
        />
      ) : running ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">
                Importando {RUN_PROGRESS} de {RUN_TOTAL}…
              </span>
              <span className="tabular-nums text-slate-500">{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-accent-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <ul className="space-y-2">
            {SYNC_ROWS.slice(0, 5).map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-lg bg-slate-950/40 px-3 py-2 ring-1 ring-white/5"
              >
                <span className="font-hanzi text-base text-slate-400" lang="zh-Hans">
                  {row.hanzi}
                </span>
                <span className="h-2 flex-1 animate-pulse rounded-full bg-white/5" />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {ACCOUNT.lastSyncAt} · {RUN_TOTAL} linhas · nada foi apagado
          </p>
          <SyncTable filter={filter} onFilter={setFilter} />
        </div>
      )}
    </Pane>
  );
}

export function VariantC(props: SyncDemoProps) {
  return (
    <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <ConnectionPane {...props} />
      <ResultPane scenario={props.scenario} />
    </div>
  );
}
