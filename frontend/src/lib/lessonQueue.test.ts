import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client.ts";
import type { StudyItem } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import {
  PRIORITY_CONFLICT_MESSAGE,
  applyCachedPriority,
  predictPriorityPosition,
  priorityErrorMessage,
  priorityStatus,
} from "./lessonQueue.ts";

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
