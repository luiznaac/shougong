import { useState } from "react";

export type RemoveMode = "hidden" | "enabled" | "disabled";

export interface PriorityActionsProps {
  name: string;
  pending: boolean;
  removeMode: RemoveMode;
  onFront: () => void;
  onBack: () => void;
  onRemove: () => void;
}

export function PriorityAlert({
  error,
  className = "",
}: { error: string | null; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={`text-sm text-rose-400 ${className}`.trim()}>
      {error}
    </p>
  );
}

const BUTTON_CLASS =
  "rounded border border-white/10 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40";

/**
 * Priority controls shared by the item header and the mobile priority panel.
 * The two pin actions are reversible; removing a priority is the destructive
 * one, so it asks for an inline confirmation instead of firing immediately.
 */
export function PriorityActions({
  name,
  pending,
  removeMode,
  onFront,
  onBack,
  onRemove,
}: PriorityActionsProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-label={`Fixar ${name} no início das lições`}
        disabled={pending}
        onClick={onFront}
        className={BUTTON_CLASS}
      >
        Início
      </button>
      <button
        type="button"
        aria-label={`Fixar ${name} no fim das lições`}
        disabled={pending}
        onClick={onBack}
        className={BUTTON_CLASS}
      >
        Fim
      </button>
      {removeMode === "hidden" ? null : confirming ? (
        <span className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-slate-300">Remover a prioridade de {name}?</span>
          <button
            type="button"
            aria-label={`Confirmar remoção de ${name}`}
            disabled={pending}
            onClick={() => {
              setConfirming(false);
              onRemove();
            }}
            className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-40"
          >
            Remover
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={BUTTON_CLASS}>
            Cancelar
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Remover prioridade de ${name}`}
          disabled={pending || removeMode === "disabled"}
          onClick={() => setConfirming(true)}
          className={BUTTON_CLASS}
        >
          Remover
        </button>
      )}
    </div>
  );
}
