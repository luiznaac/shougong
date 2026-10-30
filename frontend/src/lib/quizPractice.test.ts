import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client.ts";
import { submitRevealedGrade, summaryCopy, topBarTitle } from "./quizPractice.ts";

describe("quiz practice copy", () => {
  it("keeps the ordinary top-bar labels when recording", () => {
    expect(topBarTitle("review", true)).toBe("Review");
    expect(topBarTitle("lesson", true)).toBe("Lição");
  });

  it("labels the top bar as practice when recording is off", () => {
    expect(topBarTitle("review", false)).toBe("Prática");
  });

  it("uses the practice summary that says nothing was recorded", () => {
    expect(summaryCopy("review", false)).toEqual({
      title: "Prática concluída 🎉",
      note: "Nada foi registrado — seu SRS está intacto.",
      doneLabel: "Praticados",
    });
  });

  it("keeps the review and lesson summaries when recording", () => {
    expect(summaryCopy("review", true)).toEqual({
      title: "Sessão concluída 🎉",
      note: null,
      doneLabel: "Revisados",
    });
    expect(summaryCopy("lesson", true)).toEqual({
      title: "Lição concluída 🎉",
      note: null,
      doneLabel: "Aprendidos",
    });
  });
});

describe("submitRevealedGrade", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("issues no grade request at all under practice", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await submitRevealedGrade({
      record: false,
      itemId: 42,
      rating: "again",
      submit: (grade) => api.reviewStudyItem(grade.id, grade.rating),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues exactly one grade request when recording", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ item: {}, review: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await submitRevealedGrade({
      record: true,
      itemId: 42,
      rating: "again",
      submit: (grade) => api.reviewStudyItem(grade.id, grade.rating),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/study-items/42/reviews");
  });
});
