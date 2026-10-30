import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { studySessionKey } from "../lib/studySession.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { invalidateAfterReview, keys, priorityMutationOptions } from "./queries.ts";
import type { StudyItem } from "./types.ts";

describe("invalidateAfterReview", () => {
  it("invalidates both prefixes so Extra Study counts refresh", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);

    invalidateAfterReview(client, 42);

    const invalidated = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidated).toContainEqual(keys.studyItemsPrefix);
    expect(invalidated).toContainEqual(keys.insightsPrefix);
    expect(invalidated).toContainEqual(keys.studyItem(42));
    expect(invalidated).toContainEqual(keys.reviews(42));
  });
});

describe("priorityMutationOptions", () => {
  function seededClient() {
    const client = new QueryClient();
    const listKey = keys.studyItems();
    const leechKey = keys.studyItems({ leech: true });
    const singleKey = keys.studyItem(7);
    client.setQueryData(listKey, [
      studyItem({ id: 7 }),
      studyItem({ id: 8, priority_position: 5 }),
    ]);
    client.setQueryData(leechKey, [studyItem({ id: 7 })]);
    client.setQueryData(singleKey, studyItem({ id: 7 }));
    return { client, listKey, leechKey, singleKey };
  }

  it("optimistically writes the predicted edge into every cached list and the single item", async () => {
    const { client, listKey, leechKey, singleKey } = seededClient();

    const context = await priorityMutationOptions(client).onMutate({ id: 7, edge: "front" });

    const list = client.getQueryData<StudyItem[]>(listKey);
    const leeches = client.getQueryData<StudyItem[]>(leechKey);
    const single = client.getQueryData<StudyItem>(singleKey);
    expect(list?.find((item) => item.id === 7)?.priority_position).toBe(4);
    expect(list?.find((item) => item.id === 8)?.priority_position).toBe(5);
    expect(leeches?.[0].priority_position).toBe(4);
    expect(single?.priority_position).toBe(4);

    priorityMutationOptions(client).onError(new Error("falhou"), { id: 7, edge: "front" }, context);

    expect(
      client.getQueryData<StudyItem[]>(listKey)?.find((item) => item.id === 7)?.priority_position,
    ).toBeNull();
    expect(client.getQueryData<StudyItem[]>(leechKey)?.[0].priority_position).toBeNull();
    expect(client.getQueryData<StudyItem>(singleKey)?.priority_position).toBeNull();
  });

  it("clears the position optimistically when unpinning", async () => {
    const { client, listKey } = seededClient();
    client.setQueryData(listKey, [
      studyItem({ id: 7, priority_position: 3 }),
      studyItem({ id: 8, priority_position: 5 }),
    ]);

    await priorityMutationOptions(client).onMutate({ id: 7, edge: null });

    expect(
      client.getQueryData<StudyItem[]>(listKey)?.find((item) => item.id === 7)?.priority_position,
    ).toBeNull();
  });

  it("seeds the single-item cache from the server response", () => {
    const { client, singleKey } = seededClient();
    const serverItem = studyItem({ id: 7, priority_position: 9 });

    priorityMutationOptions(client).onSuccess(serverItem);

    expect(client.getQueryData<StudyItem>(singleKey)).toEqual(serverItem);
  });

  it("invalidates the study-items prefix and the lesson session on settle", () => {
    const { client } = seededClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);

    priorityMutationOptions(client).onSettled();

    const invalidated = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidated).toContainEqual(keys.studyItemsPrefix);
    expect(invalidated).toContainEqual(studySessionKey("lesson"));
  });
});
