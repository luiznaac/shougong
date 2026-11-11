import { DOCKED_BOTTOM } from "../lib/safeArea.ts";
import { Icon } from "./icons.tsx";

/**
 * A transient, dismissible message — the safe-feedback primitive for undo and
 * reversible actions. It floats above the mobile tab bar and respects the bottom
 * safe area.
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="fixed inset-x-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 shadow-xl ring-1 ring-white/10"
      style={{ bottom: DOCKED_BOTTOM }}
    >
      <output className="block min-w-0 flex-1 text-sm text-slate-200">{message}</output>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent-500 hover:bg-white/5"
        >
          {actionLabel}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}
