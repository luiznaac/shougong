import { usePriorityActions } from "../api/queries.ts";
import type { StudyItem } from "../api/types.ts";
import {
  PRIORITY_HINT,
  isLearning,
  isPinned,
  priorityErrorMessage,
  priorityStatus,
} from "../lib/lessonQueue.ts";
import { Panel } from "./Panel.tsx";
import { PriorityActions, PriorityAlert } from "./PriorityActions.tsx";

export type PriorityVariant = "panel" | "inline" | "compact";

export function ItemPrioritySection({
  item,
  variant = "panel",
}: {
  item: StudyItem;
  variant?: PriorityVariant;
}) {
  const priority = usePriorityActions();

  if (!isLearning(item)) return null;

  return (
    <ItemPriorityView
      item={item}
      variant={variant}
      pending={priority.pending}
      error={priority.error ? priorityErrorMessage(priority.error, item.entry.simplified) : null}
      onFront={() => priority.pinFront(item.id)}
      onBack={() => priority.pinBack(item.id)}
      onRemove={() => priority.remove(item.id)}
    />
  );
}

export interface ItemPriorityViewProps {
  item: StudyItem;
  variant?: PriorityVariant;
  pending: boolean;
  error: string | null;
  onFront: () => void;
  onBack: () => void;
  onRemove: () => void;
}

export function ItemPriorityView({
  item,
  variant = "panel",
  pending,
  error,
  onFront,
  onBack,
  onRemove,
}: ItemPriorityViewProps) {
  const actions = (
    <PriorityActions
      name={item.entry.simplified}
      pending={pending}
      removeMode={isPinned(item) ? "enabled" : "disabled"}
      onFront={onFront}
      onBack={onBack}
      onRemove={onRemove}
    />
  );

  if (variant === "compact") {
    return (
      <Panel title="Prioridade">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-200">{priorityStatus(item)}</span>
          {actions}
        </div>
        <PriorityAlert error={error} className="mt-2" />
      </Panel>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-slate-400">{priorityStatus(item)}</span>
          {actions}
        </div>
        <PriorityAlert error={error} />
      </div>
    );
  }

  return (
    <Panel title="Prioridade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-slate-200">{priorityStatus(item)}</p>
          <p className="text-sm text-slate-500">{PRIORITY_HINT}</p>
        </div>
        {actions}
      </div>
      <PriorityAlert error={error} className="mt-3" />
    </Panel>
  );
}
