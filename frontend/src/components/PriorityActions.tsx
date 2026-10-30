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

export function PriorityActions({
  name,
  pending,
  removeMode,
  onFront,
  onBack,
  onRemove,
}: PriorityActionsProps) {
  return (
    <div className="flex flex-wrap gap-1">
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
      {removeMode !== "hidden" ? (
        <button
          type="button"
          aria-label={`Remover prioridade de ${name}`}
          disabled={pending || removeMode === "disabled"}
          onClick={onRemove}
          className={BUTTON_CLASS}
        >
          Remover
        </button>
      ) : null}
    </div>
  );
}
