import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { Panel } from "./Panel.tsx";
import { Placeholder } from "./Placeholder.tsx";
import { Skeleton } from "./Skeleton.tsx";

describe("PageHeader", () => {
  it("renders its eyebrow, title and right-side summary", () => {
    const markup = renderToStaticMarkup(
      <PageHeader
        eyebrow="Quarta, 11 de novembro"
        title="Hoje"
        summary={<span>12 devidos</span>}
      />,
    );
    expect(markup).toContain("Quarta, 11 de novembro");
    expect(markup).toContain("Hoje");
    expect(markup).toContain("12 devidos");
    expect(markup).toContain("<h1");
  });
});

describe("Panel", () => {
  it("renders an optional uppercase label and action slot around its content", () => {
    const markup = renderToStaticMarkup(
      <Panel title="SRS" action={<button type="button">Ver tudo</button>}>
        <p>conteúdo</p>
      </Panel>,
    );
    expect(markup).toContain("SRS");
    expect(markup).toContain("Ver tudo");
    expect(markup).toContain("conteúdo");
  });
});

describe("Skeleton", () => {
  it("is decorative", () => {
    const markup = renderToStaticMarkup(<Skeleton />);
    expect(markup).toContain('aria-hidden="true"');
  });
});

describe("EmptyState", () => {
  it("renders its guidance copy", () => {
    const markup = renderToStaticMarkup(
      <EmptyState title="Nada por aqui" description="Volte depois da próxima lição." />,
    );
    expect(markup).toContain("Nada por aqui");
    expect(markup).toContain("Volte depois da próxima lição.");
  });
});

describe("Placeholder", () => {
  it("names the surface that has not migrated yet", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <Placeholder title="Progresso" description="A visão de progresso chega em breve." />
      </MemoryRouter>,
    );
    expect(markup).toContain("Progresso");
    expect(markup).toContain("A visão de progresso chega em breve.");
    expect(markup).toContain("Em construção");
  });

  it("can point at its section's already-built sub-surfaces", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <Placeholder
          title="Itens"
          description="A lista chega em breve."
          links={[
            { label: "Adicionar", to: "/biblioteca/adicionar" },
            { label: "Importar CSV", to: "/biblioteca/importar" },
          ]}
        />
      </MemoryRouter>,
    );
    expect(markup).toContain('href="/biblioteca/adicionar"');
    expect(markup).toContain('href="/biblioteca/importar"');
    expect(markup).toContain("Importar CSV");
  });
});
