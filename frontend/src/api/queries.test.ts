import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateAfterReview, keys } from "./queries.ts";

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
