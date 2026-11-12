import { describe, expect, it } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { formatDate, fromNow } from "./format.ts";
import { fsrsFacts } from "./itemFacts.ts";

describe("fsrsFacts", () => {
  it("reads the card as plain-language facts", () => {
    const item = studyItem({ card: { state: "review", stability: 30, difficulty: 5 } });
    const facts = Object.fromEntries(fsrsFacts(item).map((fact) => [fact.label, fact.value]));

    expect(facts.Estado).toBe("Em revisão");
    expect(facts["Próxima revisão"]).toBe(fromNow(item.card.due));
    expect(facts.Estabilidade).toBe("30.0 dias");
    expect(facts.Dificuldade).toBe("5.0 de 10");
    expect(facts["Último review"]).toBe(fromNow(item.card.last_review as string));
    expect(facts.Adicionado).toBe(formatDate(item.created_at));
  });

  it("never surfaces the raw backend state enum", () => {
    const values = fsrsFacts(studyItem({ card: { state: "relearning" } })).map(
      (fact) => fact.value,
    );

    expect(values).not.toContain("relearning");
    expect(values).toContain("Reaprendendo");
  });

  it("falls back to em dashes when FSRS has no measurements yet", () => {
    const facts = Object.fromEntries(
      fsrsFacts(studyItem({ card: { stability: null, difficulty: null, last_review: null } })).map(
        (fact) => [fact.label, fact.value],
      ),
    );

    expect(facts.Estabilidade).toBe("—");
    expect(facts.Dificuldade).toBe("—");
    expect(facts["Último review"]).toBe("nunca");
  });
});
