import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DataList, type DataListColumn } from "./DataList.tsx";

interface Row {
  id: number;
  word: string;
  meaning: string;
  hsk: string;
}

const rows: Row[] = [
  { id: 1, word: "甲", meaning: "primeiro", hsk: "HSK 1" },
  { id: 2, word: "乙", meaning: "segundo", hsk: "HSK 2" },
];

const columns: DataListColumn<Row>[] = [
  { key: "word", label: "Palavra", render: (row) => row.word },
  { key: "meaning", label: "Significado", render: (row) => row.meaning },
  { key: "hsk", label: "HSK", secondary: true, render: (row) => row.hsk },
];

function renderList() {
  return render(
    <MemoryRouter>
      <DataList
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        rowHref={(row) => `/biblioteca/itens/${row.id}`}
        chips={(row) => <span>{row.id === 1 ? "Sanguessuga" : "Prioridade"}</span>}
      />
    </MemoryRouter>,
  );
}

describe("DataList", () => {
  it("renders the desktop table and the stacked cards from the same rows", () => {
    renderList();
    const table = screen.getByRole("table");
    const cards = screen.getByRole("list");

    expect(within(table).getAllByText("甲").length).toBe(1);
    expect(within(table).getAllByText("乙").length).toBe(1);
    expect(within(cards).getAllByText("甲").length).toBe(1);
    expect(within(cards).getAllByText("乙").length).toBe(1);
  });

  it("links every row in both presentations to its destination", () => {
    renderList();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/biblioteca/itens/1",
      "/biblioteca/itens/2",
      "/biblioteca/itens/1",
      "/biblioteca/itens/2",
    ]);
    expect(screen.getAllByRole("link", { name: /甲/ })).toHaveLength(2);
  });

  it("drops the secondary columns from the stacked cards", () => {
    renderList();
    const table = screen.getByRole("table");
    const cards = screen.getByRole("list");

    expect(within(table).getByText("HSK 1")).toBeTruthy();
    expect(within(table).getByText("HSK")).toBeTruthy();
    expect(within(cards).queryByText("HSK 1")).toBeNull();
    expect(within(cards).queryByText("HSK")).toBeNull();
    expect(within(cards).getAllByText("Significado")).toHaveLength(2);
  });

  it("renders the caller's status chips in both presentations", () => {
    renderList();
    const table = screen.getByRole("table");
    const cards = screen.getByRole("list");

    expect(within(table).getByText("Sanguessuga")).toBeTruthy();
    expect(within(table).getByText("Prioridade")).toBeTruthy();
    expect(within(cards).getByText("Sanguessuga")).toBeTruthy();
    expect(within(cards).getByText("Prioridade")).toBeTruthy();
  });

  it("renders plain rows without links when no destination is given, keeping row actions usable", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const actionColumns: DataListColumn<Row>[] = [
      ...columns,
      {
        key: "action",
        label: "Fila",
        render: (row) => (
          <button type="button" onClick={() => onAdd(row.id)}>
            Adicionar {row.word}
          </button>
        ),
      },
    ];

    render(
      <MemoryRouter>
        <DataList rows={rows} columns={actionColumns} rowKey={(row) => row.id} label="Resultados" />
      </MemoryRouter>,
    );

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(within(screen.getByRole("table")).getByText("Adicionar 甲")).toBeTruthy();
    expect(within(screen.getByRole("list")).getByText("Adicionar 甲")).toBeTruthy();

    await user.click(
      within(screen.getByRole("table")).getByRole("button", { name: "Adicionar 甲" }),
    );

    expect(onAdd).toHaveBeenCalledWith(1);
  });
});
