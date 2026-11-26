import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HandwritingQuiz } from "./HandwritingQuiz.tsx";

const { createMock, quizMock } = vi.hoisted(() => {
  const quizMock = vi.fn();
  const createMock = vi.fn(() => ({ quiz: quizMock, cancelQuiz: vi.fn() }));
  return { createMock, quizMock };
});

vi.mock("hanzi-writer", () => ({ default: { create: createMock } }));

vi.mock("../api/queries.ts", () => ({
  useCharacterStrokes: () => ({
    data: { character: "好", strokes: ["M0 0 L10 10", "M10 0 L0 10"], medians: [] },
    isLoading: false,
    error: null,
  }),
}));

function quizOptions(): Record<string, unknown> {
  return quizMock.mock.calls[0][0] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HandwritingQuiz", () => {
  it("hints after 3 misses and force-accepts the stroke on the 4th", () => {
    render(<HandwritingQuiz character="好" onComplete={vi.fn()} />);

    expect(quizOptions()).toMatchObject({
      showHintAfterMisses: 3,
      markStrokeCorrectAfterMisses: 4,
    });
  });

  it("reports completion regardless of the mistake count", () => {
    const onComplete = vi.fn();
    render(<HandwritingQuiz character="好" onComplete={onComplete} />);

    const complete = quizOptions().onComplete as (summary: unknown) => void;
    complete({ totalMistakes: 50 });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not report completion before the drawing finishes", () => {
    const onComplete = vi.fn();
    render(<HandwritingQuiz character="好" onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("reports completion only once", () => {
    const onComplete = vi.fn();
    render(<HandwritingQuiz character="好" onComplete={onComplete} />);

    const complete = quizOptions().onComplete as (summary: unknown) => void;
    complete({ totalMistakes: 0 });
    complete({ totalMistakes: 0 });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
