import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoltIcon, GhostIcon, ICON_NAMES, Icon } from "./icons.tsx";

describe("icon set", () => {
  it("draws every icon as an inline stroke SVG", () => {
    for (const name of ICON_NAMES) {
      const markup = renderToStaticMarkup(<Icon name={name} />);
      expect(markup).toContain("<svg");
      expect(markup).toContain('stroke-linecap="round"');
      expect(markup).toContain('stroke-linejoin="round"');
      expect(markup).toContain('aria-hidden="true"');
    }
  });

  it("draws the badge icons with the heavier badge stroke", () => {
    expect(renderToStaticMarkup(<GhostIcon />)).toContain('stroke-width="2.6"');
    expect(renderToStaticMarkup(<BoltIcon />)).toContain('stroke-width="2.6"');
  });

  it("gives a labelled icon an image role and its pt-BR name", () => {
    const markup = renderToStaticMarkup(<GhostIcon label="Sanguessuga" />);
    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Sanguessuga"');
  });
});
