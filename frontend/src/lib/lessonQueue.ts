import { ApiError } from "../api/client.ts";
import type { PriorityEdge, StudyItem } from "../api/types.ts";

export interface LessonQueueRow {
  item: StudyItem;
  ordinal: number;
}

export const PRIORITY_CONFLICT_MESSAGE =
  "Este item não está mais em lições — ele avançou para revisão. A fila foi atualizada.";

export const PRIORITY_HINT =
  "A prioridade vale apenas para lições: fixe no início para estudar antes ou no fim para deixar para depois.";

export function isLearning(item: StudyItem): boolean {
  return item.card.state === "learning";
}

export function isPinned(item: StudyItem): boolean {
  return item.priority_position !== null;
}

export function lessonQueueRows(items: StudyItem[]): LessonQueueRow[] {
  const pinned = items
    .filter((item) => isLearning(item) && isPinned(item))
    .sort((a, b) => (a.priority_position ?? 0) - (b.priority_position ?? 0) || a.id - b.id);
  const unpinned = items
    .filter((item) => isLearning(item) && !isPinned(item))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  return [...pinned, ...unpinned].map((item, index) => ({ item, ordinal: index + 1 }));
}

export function priorityStatus(item: StudyItem): string {
  return item.priority_position === null ? "Sem prioridade" : "Prioridade ativa";
}

export function predictPriorityPosition(lists: StudyItem[][], edge: PriorityEdge): number {
  const positions = lists
    .flat()
    .map((item) => item.priority_position)
    .filter((position): position is number => typeof position === "number");
  if (positions.length === 0) return 0;
  return edge === "front" ? Math.min(...positions) - 1 : Math.max(...positions) + 1;
}

function isStudyItemArray(data: unknown): data is StudyItem[] {
  return (
    Array.isArray(data) &&
    data.every((item) => typeof item === "object" && item !== null && "priority_position" in item)
  );
}

function isStudyItem(data: unknown): data is StudyItem {
  return typeof data === "object" && data !== null && "priority_position" in data;
}

export function applyCachedPriority(
  data: unknown,
  itemId: number,
  position: number | null,
): unknown {
  if (isStudyItemArray(data)) {
    return data.map((item) =>
      item.id === itemId ? { ...item, priority_position: position } : item,
    );
  }
  if (isStudyItem(data)) {
    return data.id === itemId ? { ...data, priority_position: position } : data;
  }
  return data;
}

export function priorityErrorMessage(error: unknown, itemLabel?: string): string {
  if (error instanceof ApiError && error.status === 409) return PRIORITY_CONFLICT_MESSAGE;
  const detail = error instanceof Error ? error.message : String(error);
  const subject = itemLabel ? ` de ${itemLabel}` : "";
  return `Não foi possível atualizar a prioridade${subject}: ${detail}`;
}
