import { usePriorityActions } from "../api/queries.ts";
import { type LessonQueueRow, isPinned, priorityErrorMessage } from "../lib/lessonQueue.ts";
import { PriorityActions, PriorityAlert } from "./PriorityActions.tsx";
import { StudyItemTile } from "./StudyItemTile.tsx";

export function LessonQueuePanel({ rows }: { rows: LessonQueueRow[] }) {
  const priority = usePriorityActions();

  if (rows.length === 0) return null;

  const failedItem = rows.find(({ item }) => item.id === priority.errorItemId)?.item;

  return (
    <LessonQueueView
      rows={rows}
      pending={priority.pending}
      error={
        priority.error ? priorityErrorMessage(priority.error, failedItem?.entry.simplified) : null
      }
      onFront={priority.pinFront}
      onBack={priority.pinBack}
      onRemove={priority.remove}
    />
  );
}

export interface LessonQueueViewProps {
  rows: LessonQueueRow[];
  pending: boolean;
  error: string | null;
  onFront: (id: number) => void;
  onBack: (id: number) => void;
  onRemove: (id: number) => void;
}

export function LessonQueueView({
  rows,
  pending,
  error,
  onFront,
  onBack,
  onRemove,
}: LessonQueueViewProps) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <PriorityAlert error={error} />
      <ol aria-label="Fila de lições" aria-busy={pending} className="space-y-2">
        {rows.map(({ item, ordinal }) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3">
            <span className="w-6 text-right text-sm tabular-nums text-slate-500">{ordinal}</span>
            <StudyItemTile item={item} />
            <PriorityActions
              name={item.entry.simplified}
              pending={pending}
              removeMode={isPinned(item) ? "enabled" : "hidden"}
              onFront={() => onFront(item.id)}
              onBack={() => onBack(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
