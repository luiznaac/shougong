import { type FormEvent, useState } from "react";
import { EmptyState } from "../../../components/EmptyState.tsx";
import { Panel } from "../../../components/Panel.tsx";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { Icon } from "../../../components/icons.tsx";
import {
  ACCOUNT,
  HISTORY,
  RUN_PROGRESS,
  RUN_TOTAL,
  type RunCounts,
  STATUS_LABEL,
  SYNC_ROWS,
  type SyncDemoProps,
  type SyncHistoryEntry,
  type SyncRow,
} from "./fakeSync.ts";

// Variant B — "Conta + atividade": an account card up top (identity, session
// state, the one Sync button) and a timeline of past runs below, each entry
// expandable to its per-row detail. The connect form is the same card in its
// unconnected shape — no separate screen.

const CHIP_TONE = {
  created: "bg-emerald-500/15 text-emerald-300",
  queued: "bg-slate-500/15 text-slate-300",
  unmatched: "bg-amber-500/15 text-amber-300",
} as const;

function CountChips({ counts }: { counts: RunCounts }) {
  const items = [
    { key: "created", label: "criados", value: counts.created },
    { key: "queued", label: "já na fila", value: counts.queued },
    { key: "unmatched", label: "sem correspondência", value: counts.unmatched },
  ] as const;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {items
        .filter((item) => item.value > 0)
        .map((item) => (
          <span
            key={item.key}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CHIP_TONE[item.key]}`}
          >
            {item.value} {item.label}
          </span>
        ))}
    </span>
  );
}

function Monogram() {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-sm font-semibold text-accent-300 ring-1 ring-accent-500/30">
      HH
    </span>
  );
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "off" }) {
  const className =
    tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : "bg-slate-600";
  return <span className={`h-1.5 w-1.5 rounded-full ${className}`} />;
}

function ConnectRow({ expired, onConnect }: { expired: boolean; onConnect: () => void }) {
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
    <form onSubmit={submit} className="mt-4 space-y-2 border-t border-white/5 pt-4">
      {expired ? (
        <p className="flex items-center gap-1.5 text-xs text-amber-300">
          <Icon name="clock" size={14} />
          Sessão expirada — entre de novo para continuar sincronizando.
        </p>
      ) : null}
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="sr-only">E-mail ou usuário</span>
          <input
            type="text"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder="E-mail ou usuário"
            autoComplete="username"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent-500"
          />
        </label>
        <label className="block">
          <span className="sr-only">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
            className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent-500"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
        >
          {expired ? "Reconectar" : "Conectar"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
      <p className="text-[11px] text-slate-500">
        A senha não é guardada; o shougong retém só o cookie de sessão.
      </p>
    </form>
  );
}

function ConnectionCard({ scenario, onConnect, onSync, onReconnect }: SyncDemoProps) {
  const showForm = scenario === "desconectado" || scenario === "expirado";
  const running = scenario === "sincronizando";

  return (
    <Panel>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Monogram />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">HanziHero</p>
            {showForm ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <StatusDot tone={scenario === "expirado" ? "warn" : "off"} />
                {scenario === "expirado" ? "sessão expirada" : "não conectado"}
              </p>
            ) : (
              <>
                <p className="mt-0.5 text-xs text-slate-400">{ACCOUNT.handle}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <StatusDot tone="ok" />
                  {running
                    ? "sincronizando agora"
                    : `conectado · sessão desde ${ACCOUNT.connectedAt}`}
                </p>
              </>
            )}
          </div>
        </div>

        {showForm ? null : (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onSync}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
            >
              {running ? (
                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
              ) : null}
              {running ? "Sincronizando…" : "Sincronizar"}
            </button>
            <button
              type="button"
              onClick={onReconnect}
              className="text-xs text-slate-500 underline-offset-2 transition-colors hover:text-slate-300 hover:underline"
            >
              Reconectar
            </button>
          </div>
        )}
      </div>

      {showForm ? (
        <ConnectRow expired={scenario === "expirado"} onConnect={onConnect} />
      ) : (
        <p className="mt-4 border-t border-white/5 pt-3 text-xs text-slate-500">
          Última sincronização: <span className="text-slate-300">{ACCOUNT.lastSyncAt}</span> ·
          personagens, palavras e itens de dicionário; itens pulados ficam de fora.
        </p>
      )}
    </Panel>
  );
}

function DetailRow({ row }: { row: SyncRow }) {
  return (
    <li className="text-xs">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-hanzi text-sm text-slate-100" lang="zh-Hans">
          {row.hanzi}
        </span>
        <Pinyin value={row.pinyin} className="text-slate-400" />
        <span className="text-slate-600">·</span>
        <span
          className={
            row.status === "unmatched"
              ? "text-amber-300"
              : row.status === "created"
                ? "text-emerald-300"
                : "text-slate-400"
          }
        >
          {STATUS_LABEL[row.status]}
        </span>
      </div>
      {row.status === "unmatched" ? (
        <div className="mt-1 space-y-1">
          <p className="text-slate-500">{row.detail}</p>
          <div className="flex flex-wrap gap-1.5">
            {row.candidates.map((candidate) => (
              <span
                key={candidate.id}
                className="rounded border border-white/10 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
              >
                #{candidate.id} {candidate.pinyin} — {candidate.definitions.join("; ")}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function RunEntry({ entry, defaultOpen }: { entry: SyncHistoryEntry; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const current = entry.id === "r3";

  return (
    <li className="relative">
      <span className="absolute -left-[24px] top-2 h-2 w-2 rounded-full bg-slate-600" />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="text-xs font-medium text-slate-300">{entry.at}</span>
        <span className="flex items-center gap-2">
          <CountChips counts={entry.counts} />
          <Icon
            name="chevron-right"
            size={14}
            className={`text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </span>
      </button>
      {open ? (
        <div className="mt-2 rounded-xl bg-slate-950/40 p-3 ring-1 ring-white/5">
          {current ? (
            <ul className="space-y-1.5">
              {SYNC_ROWS.map((row) => (
                <DetailRow key={row.id} row={row} />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">
              Os detalhes por linha ficam disponíveis só para a execução mais recente.
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

function RunningEntry() {
  const percent = Math.round((RUN_PROGRESS / RUN_TOTAL) * 100);
  return (
    <li className="relative">
      <span className="absolute -left-[24px] top-2 h-2 w-2 animate-pulse rounded-full bg-accent-400" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-200">Agora</span>
        <span className="text-[11px] text-slate-500">buscando exportações…</span>
      </div>
      <div className="mt-2 space-y-1.5 rounded-xl bg-slate-950/40 p-3 ring-1 ring-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300">
            Importando {RUN_PROGRESS} de {RUN_TOTAL}…
          </span>
          <span className="tabular-nums text-slate-500">{percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-accent-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-[11px] text-slate-500">Se uma exportação falhar, nada é importado.</p>
      </div>
    </li>
  );
}

function SyncFeed({ scenario }: { scenario: SyncDemoProps["scenario"] }) {
  const running = scenario === "sincronizando";
  const entries = scenario === "desconectado" ? [] : HISTORY;
  const latestOpen = scenario === "resultado";

  return (
    <Panel
      title="Sincronizações"
      action={<span className="text-[11px] text-slate-500">aditivo — nunca apaga</span>}
    >
      {entries.length === 0 && !running ? (
        <EmptyState
          icon="layers"
          title="Nenhuma sincronização ainda"
          description="Conecte sua conta acima e toque em Sincronizar para trazer o vocabulário que você já estudou."
        />
      ) : (
        <ol className="relative ml-1 space-y-4 border-l border-white/10 pl-5">
          {running ? <RunningEntry /> : null}
          {entries.map((entry, index) => (
            <RunEntry key={entry.id} entry={entry} defaultOpen={latestOpen && index === 0} />
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function VariantB(props: SyncDemoProps) {
  return (
    <div className="space-y-5">
      <ConnectionCard {...props} />
      <SyncFeed scenario={props.scenario} />
    </div>
  );
}
