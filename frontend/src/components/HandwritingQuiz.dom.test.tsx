import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HandwritingQuiz } from "./HandwritingQuiz.tsx";

const { createMock, quizMock, strokeState } = vi.hoisted(() => {
  const quizMock = vi.fn();
  const createMock = vi.fn(
    (_target: HTMLElement, _character: string, _options: Record<string, unknown>) => ({
      quiz: quizMock,
      cancelQuiz: vi.fn(),
    }),
  );
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

const MODEL_STROKES = ["M0 0 L10 10", "M10 0 L0 10"];

function quizOptions(): Record<string, unknown> {
  return quizMock.mock.calls[0][0] as Record<string, unknown>;
}

function setPointer(pointer: "coarse" | "fine", viewportWidth: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: viewportWidth,
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === "(pointer: coarse)" && pointer === "coarse",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/** The 米字格 guide and the writer target it shares a square with. */
function canvasFrame(): HTMLElement {
  return screen.getByTestId("handwriting-canvas");
}

function guide(): HTMLElement {
  return screen.getByTestId("mizige-grid");
}

function writerTarget(): HTMLElement {
  return screen.getByTestId("handwriting-writer");
}

function writerOptions(): Record<string, unknown> {
  return createMock.mock.calls[0][2] as Record<string, unknown>;
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
  setPointer("fine", 1440);
  strokeState.current = {
    data: { character: "好", strokes: MODEL_STROKES, medians: [] },
    isLoading: false,
    error: null,
  };
});

describe("HandwritingQuiz", () => {
  it("draws a 米字格 grid behind the writer without a character outline", () => {
    render(<HandwritingQuiz character="好" onComplete={vi.fn()} />);

    const frame = canvasFrame();
    expect(frame.contains(guide())).toBe(true);
    expect(frame.contains(writerTarget())).toBe(true);
    expect(
      guide().compareDocumentPosition(writerTarget()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(guide().querySelectorAll("line")).toHaveLength(4);
    expect(guide().querySelector("path, text")).toBeNull();
    expect(createMock).toHaveBeenCalledWith(
      writerTarget(),
      "好",
      expect.objectContaining({ showCharacter: false, showOutline: false }),
    );
  });

  it("sizes one square for both the grid and the writer under a coarse pointer", () => {
    setPointer("coarse", 390);
    render(<HandwritingQuiz character="好" onComplete={vi.fn()} />);

    expect(canvasFrame().style.width).toBe("320px");
    expect(canvasFrame().style.height).toBe("320px");
    expect(writerOptions()).toMatchObject({ width: 320, height: 320 });
  });

  it("sizes one square for both the grid and the writer under a fine pointer", () => {
    setPointer("fine", 1440);
    render(<HandwritingQuiz character="好" onComplete={vi.fn()} />);

    expect(canvasFrame().style.width).toBe("220px");
    expect(canvasFrame().style.height).toBe("220px");
    expect(writerOptions()).toMatchObject({ width: 220, height: 220 });
  });

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
    render(<HandwritingQuiz character="好" onComplete={onComplete} />);

    drawStroke("M1 1 L2 2");
    drawStroke("M3 3 L4 4");
    complete();

    expect(onComplete).toHaveBeenCalledWith({
      drawing: { strokes: ["M1 1 L2 2", "M3 3 L4 4"], size: 220 },
      model: MODEL_STROKES,
    });
  });

  it("reports an empty snapshot when the character has no stroke data", () => {
    const onComplete = vi.fn();
    strokeState.current = { data: undefined, isLoading: false, error: new Error("404") };

    render(<HandwritingQuiz character="，" onComplete={onComplete} />);

    expect(onComplete).toHaveBeenCalledWith({
      drawing: { strokes: [], size: 220 },
      model: [],
    });
  });
});
