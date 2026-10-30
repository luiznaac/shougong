import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client.ts";
import type { StudyItem } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import {
  PRIORITY_CONFLICT_MESSAGE,
  applyCachedPriority,
  lessonQueueRows,
  predictPriorityPosition,
  priorityErrorMessage,
  priorityStatus,
} from "./lessonQueue.ts";

describe("lessonQueueRows", () => {
  it("leads with pinned items by position then id, then unpinned by creation then id", () => {
    const items = [
      studyItem({ id: 1, created_at: "2026-10-02T00:00:00Z", card: { state: "learning" } }),
      studyItem({ id: 2, created_at: "2026-10-01T00:00:00Z", card: { state: "learning" } }),
      studyItem({ id: 3, priority_position: 5, card: { state: "learning" } }),
      studyItem({ id: 4, priority_position: -1, card: { state: "learning" } }),
      studyItem({ id: 5, priority_position: 5, card: { state: "learning" } }),
      studyItem({ id: 6, created_at: "2026-10-01T00:00:00Z", card: { state: "learning" } }),
      studyItem({ id: 7, card: { state: "review" }, priority_position: -9 }),
    ];

    const rows = lessonQueueRows(items);

    expect(rows.map((row) => row.item.id)).toEqual([4, 3, 5, 2, 6, 1]);
    expect(rows.map((row) => row.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("filters out items that are no longer learning", () => {
    const rows = lessonQueueRows([
      studyItem({ id: 1, card: { state: "review" } }),
      studyItem({ id: 2, card: { state: "relearning" } }),
      studyItem({ id: 3, card: { state: "learning" } }),
    ]);

    expect(rows.map((row) => row.item.id)).toEqual([3]);
  });
});

describe("priorityStatus", () => {
  it("distinguishes a pinned item from an unpinned one", () => {
    expect(priorityStatus(studyItem({ priority_position: 0 }))).toBe("Prioridade ativa");
    expect(priorityStatus(studyItem({ priority_position: null }))).toBe("Sem prioridade");
  });
});

describe("predictPriorityPosition", () => {
  it("starts an empty queue at zero", () => {
    expect(predictPriorityPosition([[]], "front")).toBe(0);
    expect(predictPriorityPosition([[]], "back")).toBe(0);
  });

  it("moves one past the edge across every cached list", () => {
    const lists = [
      [studyItem({ id: 1, priority_position: 4 }), studyItem({ id: 2, priority_position: 9 })],
      [studyItem({ id: 3, priority_position: 7 })],
    ];

    expect(predictPriorityPosition(lists, "front")).toBe(3);
    expect(predictPriorityPosition(lists, "back")).toBe(10);
  });
});

describe("applyCachedPriority", () => {
  it("writes the position into every cached list that holds the item", () => {
    const first = [studyItem({ id: 7 }), studyItem({ id: 8, priority_position: 5 })];
    const second = [studyItem({ id: 7 })];
    const list = [first, second];

    const [updatedFirst, updatedSecond] = list.map(
      (entry) => applyCachedPriority(entry, 7, 4) as StudyItem[],
    );

    expect(updatedFirst[0].priority_position).toBe(4);
    expect(updatedFirst[1].priority_position).toBe(5);
    expect(updatedSecond[0].priority_position).toBe(4);
  });

  it("writes into the single-item cache and leaves unrelated data alone", () => {
    const item = studyItem({ id: 7 });
    expect(applyCachedPriority(item, 7, -1)).toMatchObject({ id: 7, priority_position: -1 });
    expect(applyCachedPriority(item, 8, -1)).toEqual(item);
    expect(applyCachedPriority("unrelated", 7, -1)).toBe("unrelated");
  });
});

describe("priorityErrorMessage", () => {
  it("surfaces the clear conflict sentence on a 409", () => {
    expect(priorityErrorMessage(new ApiError(409, "conflict"), "學")).toBe(
      PRIORITY_CONFLICT_MESSAGE,
    );
  });

  it("includes the item label and the detail for any other failure", () => {
    expect(priorityErrorMessage(new Error("rede caiu"), "學")).toBe(
      "Não foi possível atualizar a prioridade de 學: rede caiu",
    );
  });
});
