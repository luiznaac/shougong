import { type FormEvent, type ReactNode, useState } from "react";
import { useConnectHanziHero, useHanziHeroStatus, useSyncHanziHero } from "../api/queries.ts";
import type { BatchImportOutcome, HanziHeroStatus, HanziHeroSyncResponse } from "../api/types.ts";
import { formatDateTime, fromNow } from "../lib/format.ts";
import {
  SYNC_UNAVAILABLE_MESSAGE,
  connectErrorMessage,
  isSessionExpired,
} from "../lib/hanziHero.ts";
import { Panel } from "./Panel.tsx";
import { Pinyin } from "./Pinyin.tsx";
import { PanelState } from "./QueryState.tsx";
import { Icon } from "./icons.tsx";

const STEPS = ["Conectar", "Sincronizar", "Resultado"] as const;
const STEP_CONNECT = 1;
const STEP_SYNC = 2;
const STEP_RESULT = 3;

function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas da sincronização">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex flex-1 items-center gap-2"
          >
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1",
                done
                  ? "bg-accent-500/20 text-accent-300 ring-accent-500/40"
                  : active
                    ? "bg-accent-500 text-white ring-accent-500"
                    : "text-slate-500 ring-white/10",
              ].join(" ")}
            >
              {number}
            </span>
            <span
              className={[
                "text-xs font-medium",
                active ? "text-slate-100" : done ? "text-slate-400" : "text-slate-600",
              ].join(" ")}
            >
              {label}
            </span>
            {number < STEPS.length ? <span className="h-px flex-1 bg-white/10" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ConnectStep({
  expired,
  onConnected,
}: {
  expired: boolean;
  onConnected: (handle: string) => void;
}) {
  const connect = useConnectHanziHero();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const identifier = handle.trim();
    if (!identifier || !password) {
      setValidation("Informe e-mail/usuário e senha.");
      return;
    }
    setValidation(null);
    connect.mutate(
      { email_username: identifier, password },
      { onSuccess: () => onConnected(identifier) },
    );
  };

  const error = validation ?? (connect.error ? connectErrorMessage(connect.error) : null);

  return (
    <form onSubmit={submit} className="space-y-4">
      {expired ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200 ring-1 ring-amber-500/30">
          <Icon name="clock" size={16} className="mt-0.5 shrink-0" />
          <p>Sua sessão do HanziHero expirou. Reconecte para voltar a sincronizar.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Entre com sua conta HanziHero para trazer o vocabulário que você já estudou.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
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
      </div>

      {error ? (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={connect.isPending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
        >
          {connect.isPending ? "Conectando…" : expired ? "Reconectar" : "Conectar"}
        </button>
        <span className="text-xs text-slate-500">
          A senha não é guardada — só o cookie de sessão.
        </span>
      </div>
    </form>
  );
}

function ConnectedLine({ status, handle }: { status: HanziHeroStatus; handle: string | null }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/50 px-3 py-2.5 ring-1 ring-white/5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-slate-200">
            {handle ? `Conectado como ${handle}` : "Conta HanziHero conectada"}
          </span>
        </div>
        {status.connected_at ? (
          <span className="text-xs text-slate-500">
            Sessão iniciada {fromNow(status.connected_at)}
          </span>
        ) : null}
      </div>

      <div className="text-xs text-slate-500">{`Última sincronização: ${
        status.last_synced_at ? formatDateTime(status.last_synced_at) : "nunca"
      }`}</div>
    </>
  );
}

function SyncStep({
  accountLine,
  running,
  error,
  onSync,
}: {
  accountLine: ReactNode;
  running: boolean;
  error: unknown;
  onSync: () => void;
}) {
  return (
    <div className="space-y-4">
      {accountLine}

      <ul className="space-y-1.5 text-xs text-slate-400">
        <li className="flex gap-2">
          <Icon name="layers" size={14} className="mt-0.5 shrink-0 text-accent-400" />
          Personagens, palavras e itens de dicionário que você já estudou.
        </li>
        <li className="flex gap-2">
          <Icon name="close" size={14} className="mt-0.5 shrink-0 text-slate-500" />
          Itens pulados no HanziHero ficam de fora.
        </li>
        <li className="flex gap-2">
          <Icon name="spark" size={14} className="mt-0.5 shrink-0 text-slate-500" />
          Nada da sua fila é apagado ou alterado.
        </li>
      </ul>

      {error ? (
        <p role="alert" className="text-sm text-rose-400">
          {SYNC_UNAVAILABLE_MESSAGE}
        </p>
      ) : null}

      {running ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <output className="text-slate-300">Sincronizando com o HanziHero…</output>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-accent-500" />
          </div>
          <p className="text-xs text-slate-500">
            Buscando exportações do HanziHero — nada é importado se uma delas falhar.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSync}
          className="w-full rounded-md bg-accent-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-600 md:w-auto"
        >
          Sincronizar agora
        </button>
      )}
    </div>
  );
}

type ResultTab = "created" | "queued" | "unmatched";

interface ResultGroup {
  key: ResultTab;
  tabLabel: string;
  tileLabel: string;
  status: BatchImportOutcome["status"];
  tone: string;
  count: (result: HanziHeroSyncResponse) => number;
}

const RESULT_GROUPS: ResultGroup[] = [
  {
    key: "created",
    tabLabel: "Criados",
    tileLabel: "criados",
    status: "created",
    tone: "text-emerald-300",
    count: (result) => result.created,
  },
  {
    key: "queued",
    tabLabel: "Já na fila",
    tileLabel: "já na fila",
    status: "skipped",
    tone: "text-slate-200",
    count: (result) => result.already_in_queue,
  },
  {
    key: "unmatched",
    tabLabel: "Sem correspondência",
    tileLabel: "sem correspondência",
    status: "error",
    tone: "text-amber-300",
    count: (result) => result.unmatched,
  },
];

function defaultTab(result: HanziHeroSyncResponse): ResultTab {
  if (result.unmatched > 0) return "unmatched";
  if (result.created > 0) return "created";
  return "queued";
}

function ResultTiles({ result }: { result: HanziHeroSyncResponse }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {RESULT_GROUPS.map((group) => {
        const value = group.count(result);
        return (
          <div
            key={group.key}
            aria-label={`${group.tileLabel}: ${value}`}
            className="rounded-lg bg-slate-950/50 px-3 py-2 ring-1 ring-white/5"
          >
            <div className={`text-lg font-semibold tabular-nums ${group.tone}`}>{value}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              {group.tileLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: BatchImportOutcome }) {
  const unmatched = outcome.status === "error";
  return (
    <li className="border-b border-white/5 py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span className="font-hanzi text-base text-slate-100" lang="zh-Hans">
            {outcome.hanzi}
          </span>
          <Pinyin value={outcome.pinyin} className="text-xs text-slate-400" />
        </span>
        {unmatched ? (
          <span className="text-[10px] uppercase tracking-wide text-amber-300/80">sem leitura</span>
        ) : null}
      </div>
      {unmatched ? (
        <div className="mt-1 space-y-1">
          {outcome.detail ? <p className="text-xs text-slate-500">{outcome.detail}</p> : null}
          {outcome.candidates.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {outcome.candidates.map((entry) => (
                <span
                  key={entry.id}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                >
                  {`#${entry.id} ${entry.pinyin} — ${
                    entry.definitions.slice(0, 2).join("; ") || "sem definição"
                  }`}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ResultStep({
  result,
  onSync,
}: {
  result: HanziHeroSyncResponse;
  onSync: () => void;
}) {
  const [tab, setTab] = useState<ResultTab>(() => defaultTab(result));
  const active = RESULT_GROUPS.find((group) => group.key === tab) ?? RESULT_GROUPS[2];
  const rows = result.outcomes.filter((outcome) => outcome.status === active.status);

  return (
    <div className="space-y-4">
      <ResultTiles result={result} />

      <div>
        <div className="flex flex-wrap gap-1.5">
          {RESULT_GROUPS.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => setTab(group.key)}
              aria-pressed={tab === group.key}
              className={[
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                tab === group.key
                  ? "bg-white/10 text-slate-100"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {`${group.tabLabel} (${group.count(result)})`}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Nenhum item neste grupo.</p>
        ) : (
          <ul className="mt-2" aria-label={`Itens ${active.tileLabel}`}>
            {rows.map((outcome) => (
              <OutcomeRow key={outcome.row} outcome={outcome} />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-500">
          Sincronizar de novo só preenche o que falta — nada é apagado.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSync}
            className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
          >
            Sincronizar novamente
          </button>
          <span className="text-xs text-slate-500">
            {`Sincronizado ${formatDateTime(result.last_synced_at)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The HanziHero panel on Ajustes, following the approved stepwise layout: a
 * numbered rail (Conectar · Sincronizar · Resultado) whose active step derives
 * from the connection and the last sync, never a free-form wizard.
 *
 * Disconnected (or an expired session) shows the connect form; connected shows
 * the Sync action and its running progress; a completed run shows the result
 * tiles, the per-group tabs and the unmatched rows' candidate readings. A sync
 * rejected with `hanzihero_reconnect_required` drops the learner back on the
 * connect step with an explicit "session expired" notice and no summary. A
 * re-sync is additive: the result reports already-in-queue rows and says nothing
 * about deletion or reset.
 */
export function HanziHeroPanel() {
  const status = useHanziHeroStatus();
  const sync = useSyncHanziHero();
  const [handle, setHandle] = useState<string | null>(null);
  const [expiredFromSync, setExpiredFromSync] = useState(false);
  const [result, setResult] = useState<HanziHeroSyncResponse | null>(null);

  const connected = !expiredFromSync && status.data?.connected === true;

  const runSync = () => {
    setResult(null);
    sync.mutate(undefined, {
      onSuccess: (data) => {
        setExpiredFromSync(false);
        setResult(data);
      },
      onError: (error) => {
        if (isSessionExpired(error)) {
          setResult(null);
          setExpiredFromSync(true);
        }
      },
    });
  };

  const onConnected = (submitted: string) => {
    setHandle(submitted);
    setExpiredFromSync(false);
    sync.reset();
  };

  const showingResult = result !== null && !sync.isPending;
  const current = connected ? (showingResult ? STEP_RESULT : STEP_SYNC) : STEP_CONNECT;

  return (
    <Panel title="HanziHero">
      <PanelState
        isLoading={status.isLoading}
        loadingLabel="Carregando a conexão do HanziHero"
        error={status.error}
        errorTitle="Não foi possível carregar a conexão do HanziHero"
        onRetry={() => status.refetch()}
      >
        <div className="space-y-5">
          <StepRail current={current} />
          {connected && status.data ? (
            showingResult && result ? (
              <ResultStep result={result} onSync={runSync} />
            ) : (
              <SyncStep
                accountLine={<ConnectedLine status={status.data} handle={handle} />}
                running={sync.isPending}
                error={sync.error}
                onSync={runSync}
              />
            )
          ) : (
            <ConnectStep expired={expiredFromSync} onConnected={onConnected} />
          )}
        </div>
      </PanelState>
    </Panel>
  );
}
