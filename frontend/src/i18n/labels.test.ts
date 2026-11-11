import { describe, expect, it } from "vitest";
import { POS_TAG_OPTIONS } from "./posTag.ts";
import { readingFormatLabel } from "./readingFormat.ts";
import { SORT_ORDER, sortOrderLabel } from "./sortOrder.ts";
import { srsStateLabel } from "./srsState.ts";

describe("readingFormatLabel", () => {
  it("names the three reading formats in Portuguese", () => {
    expect(readingFormatLabel("paragraph")).toBe("Parágrafo");
    expect(readingFormatLabel("sentences")).toBe("Frases soltas");
    expect(readingFormatLabel("dialogue")).toBe("Diálogo");
  });
});

describe("srsStateLabel", () => {
  it("names the three FSRS states in Portuguese", () => {
    expect(srsStateLabel("learning")).toBe("Aprendendo");
    expect(srsStateLabel("review")).toBe("Em revisão");
    expect(srsStateLabel("relearning")).toBe("Reaprendendo");
  });
});

describe("sortOrderLabel", () => {
  it("names the three server sorts and lists them in a stable order", () => {
    expect(sortOrderLabel("due_asc")).toContain("Vencimento");
    expect(sortOrderLabel("created_desc")).toContain("Adicionados");
    expect(sortOrderLabel("stability_asc")).toContain("Estabilidade");
    expect(SORT_ORDER).toEqual(["due_asc", "created_desc", "stability_asc"]);
  });
});

describe("POS_TAG_OPTIONS", () => {
  it("offers the raw tags with their Portuguese names", () => {
    const labels = Object.fromEntries(POS_TAG_OPTIONS.map((option) => [option.tag, option.label]));
    expect(labels.n).toBe("substantivo");
    expect(labels.v).toBe("verbo");
    expect(labels.nr).toBe("nome de pessoa");
    expect(labels.Mg).toBe("numeral (morfema)");
  });

  it("covers every tag the HSK dataset stamps onto an entry", () => {
    const offered = POS_TAG_OPTIONS.map((option) => option.tag).sort();
    const datasetTags = [
      "Mg",
      "Rg",
      "a",
      "ad",
      "an",
      "b",
      "c",
      "cc",
      "d",
      "e",
      "f",
      "g",
      "h",
      "k",
      "l",
      "m",
      "mq",
      "n",
      "nr",
      "ns",
      "nt",
      "nz",
      "o",
      "p",
      "q",
      "qt",
      "qv",
      "r",
      "s",
      "t",
      "tg",
      "u",
      "v",
      "vn",
      "y",
      "z",
    ].sort();

    expect(offered).toEqual(datasetTags);
  });
});
