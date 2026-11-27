import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HandwritingQuiz } from "./HandwritingQuiz.tsx";

const { createMock, quizMock, strokeState } = vi.hoisted(() => {
  const quizMock = vi.fn();
  const createMock = vi.fn(() => ({ quiz: quizMock, cancelQuiz: vi.fn() }));
  const strokeState: { current: { data?: unknown; isLoading: boolean; error: unknown } } = {
    current: {
      data: { character: "好", strokes: ["M0 0 L10 10", "M10 0 L0 10"], medians: [] },
      isLoading: false,
      error: null,
    },
  };
  return { createMock, quizMock, strokeState };
});

vi.mock("hanzi-writer", () => ({ default: { create: createMock } }));

vi.mock("../api/queries.ts", () => ({
  useCharacterStrokes: () => strokeState.current,
}));

function quizOptions(): Record<string, unknown> {
  return quizMock.mock.calls[0][0] as Record<string, unknown>;
}

function drawStroke(pathString: string) {
  const onCorrectStroke = quizOptions().onCorrectStroke as (data: unknown) => void;
  onCorrectStroke({ drawnPath: { pathString } });
}

function complete() {
  const onComplete = quizOptions().onComplete as (summary: unknown) => void;
  onComplete({ totalMistakes: 0 });
}

beforeEach(() => {
  vi.clearAllMocks();
  strokeState.current = {
    data: { character: "好", strokes: ["M0 0 L10 10", "M10 0 L0 10"], medians: [] },
    isLoading: false,
    error: null,
  };
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

    const completeWithMistakes = quizOptions().onComplete as (summary: unknown) => void;
    completeWithMistakes({ totalMistakes: 50 });

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

    complete();
    complete();

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("snapshots the learner's accepted strokes with the already-fetched model", () => {
    const onComplete = vi.fn();
    render(<HandwritingQuiz character="好" sizePx={170} onComplete={onComplete} />);

    drawStroke("M1 1 L2 2");
    drawStroke("M3 3 L4 4");
    complete();

    expect(onComplete).toHaveBeenCalledWith({
      drawing: { strokes: ["M1 1 L2 2", "M3 3 L4 4"], size: 170 },
      model: ["M0 0 L10 10", "M10 0 L0 10"],
    });
  });

  it("reports an empty snapshot when the character has no stroke data", () => {
    const onComplete = vi.fn();
    strokeState.current = { data: undefined, isLoading: false, error: new Error("404") };

    render(<HandwritingQuiz character="，" sizePx={170} onComplete={onComplete} />);

    expect(onComplete).toHaveBeenCalledWith({
      drawing: { strokes: [], size: 170 },
      model: [],
    });
  });
});
