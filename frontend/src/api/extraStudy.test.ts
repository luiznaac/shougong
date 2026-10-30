import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client.ts";

const emptyResponse = {
  from: "2026-10-28T03:00:00.000Z",
  to: "2026-10-31T03:00:00.000Z",
  recent_mistakes: { total: 0, items: [] },
  recently_learned: { total: 0, items: [] },
};

describe("getExtraStudy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests one insight range as from/to instants", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(emptyResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.getExtraStudy("2026-10-28T03:00:00.000Z", "2026-10-31T03:00:00.000Z");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/study/insights/extra-study?from=2026-10-28T03%3A00%3A00.000Z&to=2026-10-31T03%3A00%3A00.000Z",
    );
  });
});
