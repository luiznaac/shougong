import { usePriorityActions } from "../api/queries.ts";
import type { StudyItem } from "../api/types.ts";
import {
  PRIORITY_HINT,
  isLearning,
  isPinned,
  priorityErrorMessage,
  priorityStatus,
} from "../lib/lessonQueue.ts";
import { PriorityActions, PriorityAlert } from "./PriorityActions.tsx";

export function ItemPrioritySection({ item }: { item: StudyItem }) {
  const priority = usePriorityActions();

  if (!isLearning(item)) return null;

  return (
    <ItemPriorityView
      item={item}
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
  pending: boolean;
  error: string | null;
  onFront: () => void;
  onBack: () => void;
  onRemove: () => void;
}

export function ItemPriorityView({
  item,
  pending,
  error,
  onFront,
  onBack,
  onRemove,
}: ItemPriorityViewProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Prioridade
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-slate-200">{priorityStatus(item)}</p>
          <p className="text-sm text-slate-500">{PRIORITY_HINT}</p>
        </div>
        <PriorityActions
          name={item.entry.simplified}
          pending={pending}
          removeMode={isPinned(item) ? "enabled" : "disabled"}
          onFront={onFront}
          onBack={onBack}
          onRemove={onRemove}
        />
      </div>
      <PriorityAlert error={error} className="mt-3" />
    </section>
  );
}
