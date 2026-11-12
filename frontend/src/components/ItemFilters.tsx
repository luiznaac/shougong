import { type ChangeEvent, useEffect, useRef, useState } from "react";
import type { StudyItemSort } from "../api/types.ts";
import { POS_TAG_OPTIONS } from "../i18n/posTag.ts";
import { SORT_ORDER, sortOrderLabel } from "../i18n/sortOrder.ts";
import { srsStateLabel } from "../i18n/srsState.ts";
import {
  HSK_LEVELS,
  type ItemIndexState,
  SRS_STATES,
  dueRangePatch,
  hasFilters,
  toggleValue,
} from "../lib/itemIndex.ts";
import { Panel } from "./Panel.tsx";

const chipClass = (pressed: boolean) =>
  [
    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
    pressed
      ? "bg-accent-500 text-white"
      : "bg-slate-950 text-slate-300 ring-1 ring-white/10 hover:text-white",
  ].join(" ");

const fieldClass =
  "rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200";

function FilterGroup<T extends string | number>({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const pressed = selected.includes(option.value);
          return (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={pressed}
              onClick={() => onToggle(option.value)}
              className={chipClass(pressed)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * A responsive search box: the draft is local so typing is instant, the URL is
 * updated from the change handler after a short pause, and an external URL
 * change (back/forward, clear filters) resets the draft during render.
 */
function SearchField({ value, onSearch }: { value: string; onSearch: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    setDraft(value);
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setDraft(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next.trim()), 250);
  };

  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buscar</span>
      <input
        type="search"
        value={draft}
        onChange={handleChange}
        placeholder="hanzi ou pinyin — 學, xue2…"
        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent-500"
      />
    </label>
  );
}

/** Biblioteca's filter and sort panel. It only reports patches; the page owns
 * the URL and resets the list position when a narrowing filter changes. */
export function ItemFilters({
  state,
  onNarrow,
  onClear,
  resetToken,
}: {
  state: ItemIndexState;
  onNarrow: (patch: Partial<ItemIndexState>) => void;
  onClear: () => void;
  /** Bumped by the page on "Limpar filtros"; remounts the search box so a
   * pending debounce cannot re-apply the search just cleared. */
  resetToken: number;
}) {
  return (
    <Panel title="Filtros">
      <div className="space-y-4">
        <SearchField
          key={resetToken}
          value={state.search}
          onSearch={(search) => onNarrow({ search })}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <FilterGroup
            legend="Estado"
            options={SRS_STATES.map((value) => ({ value, label: srsStateLabel(value) }))}
            selected={state.states}
            onToggle={(value) => onNarrow({ states: toggleValue(state.states, value) })}
          />
          <FilterGroup
            legend="HSK"
            options={HSK_LEVELS.map((value) => ({
              value,
              label: value === "none" ? "Sem HSK" : `HSK ${value}`,
            }))}
            selected={state.hskLevels}
            onToggle={(value) => onNarrow({ hskLevels: toggleValue(state.hskLevels, value) })}
          />
          <FilterGroup
            legend="Classe gramatical"
            options={POS_TAG_OPTIONS.map(({ tag, label }) => ({ value: tag, label }))}
            selected={state.posTags}
            onToggle={(value) => onNarrow({ posTags: toggleValue(state.posTags, value) })}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vence a partir de
            </span>
            <input
              type="date"
              value={state.dueFrom ?? ""}
              onChange={(event) =>
                onNarrow(dueRangePatch(state, "dueFrom", event.target.value || undefined))
              }
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vence até
            </span>
            <input
              type="date"
              value={state.dueTo ?? ""}
              onChange={(event) =>
                onNarrow(dueRangePatch(state, "dueTo", event.target.value || undefined))
              }
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ordenar por
            </span>
            <select
              value={state.sort}
              onChange={(event) => onNarrow({ sort: event.target.value as StudyItemSort })}
              className={fieldClass}
            >
              {SORT_ORDER.map((value) => (
                <option key={value} value={value}>
                  {sortOrderLabel(value)}
                </option>
              ))}
            </select>
          </label>
          {hasFilters(state) ? (
            <button
              type="button"
              onClick={onClear}
              className="min-h-9 rounded-lg px-3 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
