import { type FormEvent, useState } from "react";
import { Panel } from "../../../components/Panel.tsx";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { Icon } from "../../../components/icons.tsx";
import {
  ACCOUNT,
  RUN_COUNTS,
  RUN_PROGRESS,
  RUN_TOTAL,
  SYNC_ROWS,
  type SyncDemoProps,
  type SyncRow,
} from "./fakeSync.ts";

// Variant A — "Passo a passo": one panel, one step at a time. The connect form,
// the sync action and the result never share the screen; a numbered rail shows
// where you are. Mobile-shaped: a single column of one thing to do next.

const STEPS = ["Conectar", "Sincronizar", "Resultado"] as const;

function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas da sincronização">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
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

function ConnectForm({ onConnect, expired }: { onConnect: () => void; expired: boolean }) {
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
    <form onSubmit={submit} className="space-y-4">
      {expired ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200 ring-1 ring-amber-500/30">
          <Icon name="clock" size={16} className="mt-0.5 shrink-0" />
          <p>Sua sessão do HanziHero expirou. Reconecte para voltar a sincronizar.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Entre com sua conta HanziHero para trazer o vocabulário que você já estudou. Nada é
          importado até você apertar Sincronizar.
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
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
        >
          {expired ? "Reconectar" : "Conectar"}
        </button>
        <span className="text-xs text-slate-500">
          A senha não é guardada — só o cookie de sessão.
        </span>
      </div>
    </form>
  );
}

function SyncStep({
  onSync,
  onReconnect,
  running,
}: {
  onSync: () => void;
  onReconnect: () => void;
  running: boolean;
}) {
  const percent = Math.round((RUN_PROGRESS / RUN_TOTAL) * 100);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/50 px-3 py-2.5 ring-1 ring-white/5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-slate-200">Conectado como {ACCOUNT.handle}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>sessão desde {ACCOUNT.connectedAt}</span>
          <button
            type="button"
            onClick={onReconnect}
            className="text-slate-500 underline-offset-2 transition-colors hover:text-slate-300 hover:underline"
          >
            Reconectar
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Última sincronização: <span className="text-slate-300">{ACCOUNT.lastSyncAt}</span>
      </div>

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

      {running ? (
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

function Tiles() {
  const tiles = [
    { label: "criados", value: RUN_COUNTS.created, tone: "text-emerald-300" },
    { label: "já na fila", value: RUN_COUNTS.queued, tone: "text-slate-200" },
    { label: "sem correspondência", value: RUN_COUNTS.unmatched, tone: "text-amber-300" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg bg-slate-950/50 px-3 py-2 ring-1 ring-white/5">
          <div className={`text-lg font-semibold tabular-nums ${tile.tone}`}>{tile.value}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}

function RowLine({ row }: { row: SyncRow }) {
  return (
    <li className="border-b border-white/5 py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span className="font-hanzi text-base text-slate-100" lang="zh-Hans">
            {row.hanzi}
          </span>
          <Pinyin value={row.pinyin} className="text-xs text-slate-400" />
        </span>
        {row.status === "unmatched" ? (
          <span className="text-[10px] uppercase tracking-wide text-amber-300/80">sem leitura</span>
        ) : null}
      </div>
      {row.status === "unmatched" ? (
        <div className="mt-1 space-y-1">
          <p className="text-xs text-slate-500">{row.detail}</p>
          <div className="flex flex-wrap gap-1.5">
            {row.candidates.map((candidate) => (
              <span
                key={candidate.id}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
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

const RESULT_TABS = [
  { key: "unmatched", label: "Sem correspondência", count: RUN_COUNTS.unmatched },
  { key: "created", label: "Criados", count: RUN_COUNTS.created },
  { key: "queued", label: "Já na fila", count: RUN_COUNTS.queued },
] as const;

function ResultStep({ onSync }: { onSync: () => void }) {
  const [tab, setTab] = useState<(typeof RESULT_TABS)[number]["key"]>("unmatched");
  const rows = SYNC_ROWS.filter((row) => row.status === tab);

  return (
    <div className="space-y-4">
      <Tiles />

      <div>
        <div className="flex flex-wrap gap-1.5">
          {RESULT_TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-pressed={tab === item.key}
              className={[
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                tab === item.key
                  ? "bg-white/10 text-slate-100"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>
        <ul className="mt-2">
          {rows.map((row) => (
            <RowLine key={row.id} row={row} />
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSync}
          className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
        >
          Sincronizar novamente
        </button>
        <span className="text-xs text-slate-500">Sincronizado {ACCOUNT.lastSyncAt}</span>
      </div>
    </div>
  );
}

export function VariantA({ scenario, onConnect, onSync, onReconnect }: SyncDemoProps) {
  const step =
    scenario === "resultado" ? 3 : scenario === "conectado" || scenario === "sincronizando" ? 2 : 1;

  return (
    <Panel title="HanziHero">
      <div className="space-y-5">
        <StepRail current={step} />
        {step === 1 ? (
          <ConnectForm onConnect={onConnect} expired={scenario === "expirado"} />
        ) : step === 2 ? (
          <SyncStep
            onSync={onSync}
            onReconnect={onReconnect}
            running={scenario === "sincronizando"}
          />
        ) : (
          <ResultStep onSync={onSync} />
        )}
      </div>
    </Panel>
  );
}
