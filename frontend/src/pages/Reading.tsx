import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ApiError } from "../api/client.ts";
import { useAddStudyItem, useGenerateReading, useReadingHistory, useStudyItems } from "../api/queries.ts";
import type { ReadingFormat, ReadingToken, SavedReadingText } from "../api/types.ts";
import { Pinyin } from "../components/Pinyin.tsx";

const FORMAT_LABELS: Record<ReadingFormat, string> = {
  paragraph: "Parágrafo",
  sentences: "Frases soltas",
};

export function Reading() {
  const [format, setFormat] = useState<ReadingFormat>("paragraph");
  const [maxExtraWords, setMaxExtraWords] = useState(2);
  const [topic, setTopic] = useState("");
  const [current, setCurrent] = useState<SavedReadingText | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateMutation = useGenerateReading();
  const { data: history, isLoading: historyLoading } = useReadingHistory();

  const generate = async () => {
    setError(null);
    try {
      const saved = await generateMutation.mutateAsync({
        format,
        max_extra_words: maxExtraWords,
        topic: topic.trim() || null,
      });
      setCurrent(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Leitura</h1>
        <p className="mt-1 text-sm text-slate-400">
          Gere um texto em mandarim restrito ao seu vocabulário de estudo. Clique numa palavra para
          ver pinyin, classe gramatical e definição.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-white/10 bg-slate-900 p-4">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Formato
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ReadingFormat)}
            className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
          >
            <option value="paragraph">Parágrafo</option>
            <option value="sentences">Frases soltas</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-400">
          Palavras extras (máx.)
          <input
            type="number"
            min={0}
            max={20}
            value={maxExtraWords}
            onChange={(e) => setMaxExtraWords(Number(e.target.value))}
            className="w-24 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
          />
        </label>

        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm text-slate-400">
          Tópico (opcional)
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="ex.: viagem, comida…"
            maxLength={200}
            className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-slate-100"
          />
        </label>

        <button
          onClick={generate}
          disabled={generateMutation.isPending}
          className="rounded-md bg-accent-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          {generateMutation.isPending ? "Gerando…" : "Gerar"}
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {current && (
        <div className="rounded-lg border border-white/10 bg-slate-900 p-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>#{current.id}</span>
            <span>&middot;</span>
            <span>{FORMAT_LABELS[current.format]}</span>
            {current.topic && (
              <>
                <span>&middot;</span>
                <span>{current.topic}</span>
              </>
            )}
            <span className="ml-auto">{new Date(current.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-3">
            <ReadingTokens tokens={current.tokens} />
          </div>
          {current.extra_word_count > 0 && (
            <p className="mt-4 text-xs text-amber-400">
              {current.extra_word_count} palavra(s) fora do vocabulário conhecido.
            </p>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Histórico</h2>
        {historyLoading && <p className="mt-2 text-sm text-slate-500">Carregando…</p>}
        <ul className="mt-2 divide-y divide-white/5">
          {(history ?? []).map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setCurrent(item)}
                className={`w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5 ${
                  current?.id === item.id ? "bg-white/5" : ""
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>#{item.id}</span>
                  <span>&middot;</span>
                  <span>{FORMAT_LABELS[item.format]}</span>
                  {item.topic && (
                    <>
                      <span>&middot;</span>
                      <span className="truncate">{item.topic}</span>
                    </>
                  )}
                  {item.extra_word_count > 0 && (
                    <>
                      <span>&middot;</span>
                      <span className="text-amber-400">{item.extra_word_count} extra(s)</span>
                    </>
                  )}
                  <span className="ml-auto shrink-0">{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <p className="font-hanzi mt-1 truncate text-sm text-slate-200">
                  {item.tokens.map((t) => t.text).join("")}
                </p>
              </button>
            </li>
          ))}
        </ul>
        {!historyLoading && (history ?? []).length === 0 && (
          <p className="mt-2 text-sm text-slate-500">Nenhum texto gerado ainda.</p>
        )}
      </div>
    </div>
  );
}

function ReadingTokens({ tokens }: { tokens: ReadingToken[] }) {
  return (
    <p lang="zh-Hans" className="font-hanzi whitespace-pre-wrap text-2xl leading-loose">
      {tokens.map((token, i) =>
        token.is_word ? <WordToken key={i} token={token} /> : <span key={i}>{token.text}</span>,
      )}
    </p>
  );
}

function WordToken({ token }: { token: ReadingToken }) {
  const addMutation = useAddStudyItem();
  const { data: studyItems } = useStudyItems();
  const [addError, setAddError] = useState<string | null>(null);

  const alreadyQueued =
    token.dictionary_entry_id != null &&
    (studyItems ?? []).some((item) => item.entry.id === token.dictionary_entry_id);

  const addToStudy = async () => {
    if (token.dictionary_entry_id == null) return;
    setAddError(null);
    try {
      await addMutation.mutateAsync(token.dictionary_entry_id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return; // already queued, nothing to do
      setAddError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`rounded px-0.5 outline-none transition-colors hover:bg-white/10 ${
            token.is_extra
              ? "text-amber-400 underline decoration-dotted underline-offset-4"
              : "text-slate-100"
          }`}
        >
          {token.text}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          className="z-50 max-w-xs rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm shadow-xl"
        >
          {token.pinyin ? (
            <Pinyin value={token.pinyin} />
          ) : (
            <p className="text-slate-500">Sem entrada no dicionário</p>
          )}
          {token.part_of_speech && (
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {token.part_of_speech}
            </p>
          )}
          {token.definitions.length > 0 && (
            <p className="mt-1 text-slate-300">{token.definitions.join("; ")}</p>
          )}
          {token.is_extra && <p className="mt-1 text-xs text-amber-400">Fora do vocabulário conhecido</p>}
          {token.is_extra && token.dictionary_entry_id != null && (
            <button
              type="button"
              onClick={addToStudy}
              disabled={addMutation.isPending || alreadyQueued}
              className="mt-2 w-full rounded-md bg-accent-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
            >
              {alreadyQueued ? "Já está na fila" : addMutation.isPending ? "Adicionando…" : "Adicionar ao estudo"}
            </button>
          )}
          {addError && <p className="mt-1 text-xs text-rose-400">{addError}</p>}
          <Popover.Arrow className="fill-slate-800" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
