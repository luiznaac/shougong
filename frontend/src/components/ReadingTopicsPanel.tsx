import { useState } from "react";
import {
  useAddReadingTopic,
  useDeleteReadingTopic,
  useReadingTopics,
  useSetReadingTopicActive,
} from "../api/queries.ts";

/**
 * "Temas sorteáveis" — the editable list of everyday scenarios the generator
 * draws from when the free-text topic is left blank.
 */
export function ReadingTopicsPanel() {
  const { data: topics, isLoading } = useReadingTopics();
  const add = useAddReadingTopic();
  const setActive = useSetReadingTopicActive();
  const remove = useDeleteReadingTopic();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const scenario = draft.trim();
    if (!scenario) return;
    setError(null);
    try {
      await add.mutateAsync(scenario);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const activeCount = (topics ?? []).filter((t) => t.active).length;

  return (
    <details className="rounded-lg border border-white/10 bg-slate-900">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Temas sorteáveis
        {topics && (
          <span className="ml-2 font-normal normal-case text-slate-500">
            {activeCount} ativo(s) de {topics.length}
          </span>
        )}
      </summary>

      <div className="space-y-3 px-4 pb-4">
        <p className="text-xs text-slate-500">
          Quando você gera um texto sem preencher o tópico, o app sorteia um destes cenários (só os ativos),
          evitando os usados recentemente.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="novo cenário, em inglês (ex.: a lost key)"
            maxLength={255}
            className="flex-1 rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
          />
          <button
            onClick={submit}
            disabled={add.isPending || !draft.trim()}
            className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}

        {isLoading && <p className="text-sm text-slate-500">Carregando…</p>}
        <ul className="divide-y divide-white/5">
          {(topics ?? []).map((topic) => (
            <li key={topic.id} className="flex items-center gap-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={topic.active}
                onChange={(e) => setActive.mutate({ id: topic.id, active: e.target.checked })}
                className="accent-accent-500"
                aria-label="ativo"
              />
              <span className={topic.active ? "flex-1 text-slate-200" : "flex-1 text-slate-500 line-through"}>
                {topic.scenario}
              </span>
              <button
                onClick={() => remove.mutate(topic.id)}
                className="text-xs text-slate-500 transition-colors hover:text-rose-400"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
