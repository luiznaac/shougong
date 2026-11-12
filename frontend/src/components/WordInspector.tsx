import { useState } from "react";
import { ApiError } from "../api/client.ts";
import { useAddStudyItem, useStudyItems } from "../api/queries.ts";
import type { ReadingToken } from "../api/types.ts";
import { partOfSpeechLabel } from "../i18n/partOfSpeech.ts";
import { DOCKED_BOTTOM, SAFE_AREA_BOTTOM } from "../lib/safeArea.ts";
import { EmptyState } from "./EmptyState.tsx";
import { Panel } from "./Panel.tsx";
import { Pinyin } from "./Pinyin.tsx";
import { Icon } from "./icons.tsx";

/**
 * The persistent desktop word inspector. It sits in the right rail, so looking a
 * word up never covers the article; the same `WordDetail` backs the mobile
 * sticky sheet.
 */
export function WordInspector({ token }: { token: ReadingToken | null }) {
  return (
    <Panel title="Palavra">
      {token ? (
        <WordDetail token={token} />
      ) : (
        <EmptyState
          icon="search"
          title="Nenhuma palavra selecionada"
          description="Clique numa palavra do texto para ver pinyin, classe e definições."
        />
      )}
    </Panel>
  );
}

/** The mobile sticky bottom word card: a dismissible sheet above the tab bar. */
export function WordSheet({
  token,
  onDismiss,
}: {
  token: ReadingToken;
  onDismiss: () => void;
}) {
  return (
    <dialog
      open
      aria-label="Palavra selecionada"
      className="fixed inset-x-3 z-50 mx-auto max-w-md rounded-2xl bg-slate-900 p-4 text-slate-200 shadow-2xl ring-1 ring-white/10"
      style={{ bottom: DOCKED_BOTTOM, paddingBottom: `calc(1rem + ${SAFE_AREA_BOTTOM})` }}
    >
      <div className="mb-1 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar palavra"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <WordDetail token={token} />
    </dialog>
  );
}

function WordDetail({ token }: { token: ReadingToken }) {
  const add = useAddStudyItem();
  const { data: studyItems } = useStudyItems();
  const [addError, setAddError] = useState<string | null>(null);

  const entryId = token.dictionary_entry_id;
  const queued = entryId != null && (studyItems ?? []).some((item) => item.entry.id === entryId);
  const pos = partOfSpeechLabel(token.part_of_speech);

  const addToStudy = async () => {
    if (entryId == null) return;
    setAddError(null);
    try {
      await add.mutateAsync(entryId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return; // already queued
      setAddError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span lang="zh-Hans" className="font-hanzi text-3xl text-slate-100">
          {token.text}
        </span>
        {token.pinyin ? (
          <Pinyin value={token.pinyin} className="text-lg" />
        ) : (
          <span className="text-sm text-slate-500">Sem entrada no dicionário</span>
        )}
      </div>

      {pos ? <p className="text-xs uppercase tracking-wide text-slate-500">{pos}</p> : null}

      {token.definitions.length > 0 ? (
        <p className="text-sm text-slate-300">{token.definitions.join("; ")}</p>
      ) : null}

      {token.is_extra ? (
        <p className="text-xs text-amber-400">Fora do vocabulário conhecido</p>
      ) : null}

      {entryId != null ? (
        <button
          type="button"
          onClick={addToStudy}
          disabled={add.isPending || queued}
          className="mt-1 w-full rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {queued ? "Na fila" : add.isPending ? "Adicionando…" : "Adicionar ao estudo"}
        </button>
      ) : null}

      {addError ? (
        <p role="alert" className="text-xs text-rose-400">
          {addError}
        </p>
      ) : null}
    </div>
  );
}
