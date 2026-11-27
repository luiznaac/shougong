import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SlotCapture } from "../lib/selfCheck.ts";
import { SlotRow } from "./SlotRow.tsx";

const strokes = ["M0 0 L10 10", "M10 0 L0 10"];

function drawn(learner: string[] = strokes): SlotCapture {
  return {
    drawing: { strokes: learner, size: 170 },
    model: strokes,
  };
}

function markupsOf(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("SlotRow", () => {
  it("shows one slot per character, including a single-character word", () => {
    const html = renderToStaticMarkup(
      <SlotRow chars={["好"]} snapshots={[null]} currentIdx={0} reveal="none" />,
    );

    expect(markupsOf(html, "<li ")).toBe(1);
    expect(html).toContain('aria-current="step"');
  });

  it("highlights the current slot and keeps each completed drawing", () => {
    const html = renderToStaticMarkup(
      <SlotRow chars={["学", "习"]} snapshots={[drawn(), null]} currentIdx={1} reveal="none" />,
    );

    expect(markupsOf(html, "<li ")).toBe(2);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('aria-label="Seu traço de 学"');
    expect(html).not.toContain('aria-label="Seu traço de 习"');
  });

  it("shows the learner's drawing beside the model for every slot at the comparison", () => {
    const html = renderToStaticMarkup(
      <SlotRow
        chars={["学", "习"]}
        snapshots={[drawn(), drawn(["M2 2 L3 3"])]}
        currentIdx={1}
        reveal="whole"
      />,
    );

    expect(markupsOf(html, ">Seu traço<")).toBe(2);
    expect(markupsOf(html, ">Modelo<")).toBe(2);
    expect(markupsOf(html, 'aria-label="Seu traço de 学"')).toBe(1);
    expect(markupsOf(html, 'aria-label="Seu traço de 习"')).toBe(1);
    expect(markupsOf(html, 'aria-label="Ordem dos traços de 学"')).toBe(1);
    expect(markupsOf(html, 'aria-label="Ordem dos traços de 习"')).toBe(1);
  });

  it("shows the comparison only for the current slot on an early peek", () => {
    const html = renderToStaticMarkup(
      <SlotRow
        chars={["学", "习"]}
        snapshots={[null, null]}
        currentIdx={0}
        reveal="peek"
        peekModel={strokes}
      />,
    );

    expect(markupsOf(html, ">Seu traço<")).toBe(1);
    expect(markupsOf(html, ">Modelo<")).toBe(1);
    expect(html).toContain('aria-label="Comparação de 学"');
    expect(html).not.toContain('aria-label="Comparação de 习"');
    expect(html).toContain('aria-label="Caractere 2"');
    expect(html).toContain('aria-label="Ordem dos traços de 学"');
    expect(html).not.toContain('aria-label="Ordem dos traços de 习"');
  });

  it("falls back to the character when a slot has no fetched model strokes", () => {
    const html = renderToStaticMarkup(
      <SlotRow
        chars={["好"]}
        snapshots={[{ drawing: { strokes: [], size: 170 }, model: [] }]}
        currentIdx={0}
        reveal="whole"
      />,
    );

    expect(html).toContain(">Modelo<");
    expect(html).toContain('lang="zh-Hans"');
  });
});
