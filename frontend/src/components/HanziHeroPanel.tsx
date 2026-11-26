import { type FormEvent, useState } from "react";
import { useConnectHanziHero, useHanziHeroStatus } from "../api/queries.ts";
import type { HanziHeroStatus } from "../api/types.ts";
import { formatDateTime, fromNow } from "../lib/format.ts";
import { connectErrorMessage } from "../lib/hanziHero.ts";
import { Panel } from "./Panel.tsx";
import { PanelState } from "./QueryState.tsx";
import { Icon } from "./icons.tsx";

const STEPS = ["Conectar", "Sincronizar", "Resultado"] as const;
const STEP_CONNECT = 1;
const STEP_SYNC = 2;

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

function ConnectedStep({ status, handle }: { status: HanziHeroStatus; handle: string | null }) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

/**
 * The HanziHero panel on Ajustes. The active rail step derives from the stored
 * connection: disconnected (or `expired`) shows the connect form; connected
 * shows the account status. On a successful connect the status line names the
 * handle the learner just submitted; after a reload it falls back to a generic
 * account line, because the backend stores no username (connect in #215 never
 * persists it). `expired` is supplied by the sync flow when HanziHero rejects
 * the stored session, and its owner clears it once a reconnect succeeds — this
 * slice has no sync, so it stays false. The Sync action and the Result step land
 * in a later change; this slice deliberately ships no Sync button.
 */
export function HanziHeroPanel({ expired = false }: { expired?: boolean }) {
  const status = useHanziHeroStatus();
  const [handle, setHandle] = useState<string | null>(null);
  const connected = !expired && status.data?.connected === true;

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
          <StepRail current={connected ? STEP_SYNC : STEP_CONNECT} />
          {connected && status.data ? (
            <ConnectedStep status={status.data} handle={handle} />
          ) : (
            <ConnectStep expired={expired} onConnected={setHandle} />
          )}
        </div>
      </PanelState>
    </Panel>
  );
}
