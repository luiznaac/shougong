import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElementSize } from "./useElementSize.ts";

let callbacks: ResizeObserverCallback[];
let observeSpy: ReturnType<typeof vi.fn>;
let disconnectSpy: ReturnType<typeof vi.fn>;
let rect: { width: number; height: number };

beforeEach(() => {
  callbacks = [];
  observeSpy = vi.fn();
  disconnectSpy = vi.fn();
  rect = { width: 300, height: 200 };
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => rect as DOMRect,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        callbacks.push(callback);
      }
      observe = observeSpy;
      unobserve = vi.fn();
      disconnect = disconnectSpy;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Probe() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  return <div ref={ref} data-testid="probe" data-width={size.width} data-height={size.height} />;
}

function probe(): HTMLElement {
  return document.querySelector('[data-testid="probe"]') as HTMLElement;
}

describe("useElementSize", () => {
  it("reads the element's size once it mounts", () => {
    render(<Probe />);

    expect(probe().dataset.width).toBe("300");
    expect(probe().dataset.height).toBe("200");
    expect(observeSpy).toHaveBeenCalledWith(probe());
  });

  it("follows the element as it resizes", () => {
    render(<Probe />);

    rect = { width: 250, height: 180 };
    act(() => {
      callbacks[0]([{ contentRect: rect } as ResizeObserverEntry], {} as ResizeObserver);
    });

    expect(probe().dataset.width).toBe("250");
    expect(probe().dataset.height).toBe("180");
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<Probe />);

    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
