import { useVocabularyProfile } from "../api/queries.ts";
import type { VocabularyCategory, VocabularyProfile } from "../api/types.ts";
import { vocabularyCategoryLabel } from "../i18n/vocabularyCategory.ts";

/**
 * "Meu vocabulário" — the HSK level and grammatical classes the app derives for
 * every word in the study queue (from the dictionary's HSK data), so the reading
 * generator can sample a balanced working set. Read-only overview.
 */
export function VocabularyPanel() {
  const { data, isLoading, error } = useVocabularyProfile();

  const summary = data?.summary;

  return (
    <details className="rounded-lg border border-white/10 bg-slate-900">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Meu vocabulário
        {summary && (
          <span className="ml-2 font-normal normal-case text-slate-500">
            {summary.categorised}/{summary.total} no HSK
          </span>
        )}
      </summary>

      <div className="space-y-4 px-4 pb-4">
        {isLoading && <p className="text-sm text-slate-500">Carregando…</p>}
        {error && <p className="text-sm text-rose-400">Não foi possível carregar o vocabulário.</p>}

        {summary && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              {Object.entries(summary.by_category)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, n]) => (
                  <span key={cat}>
                    {vocabularyCategoryLabel(cat as VocabularyCategory)}: <span className="text-slate-200">{n}</span>
                  </span>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {Object.entries(summary.by_hsk_level)
                .sort((a, b) => (a[0] === "none" ? 1 : b[0] === "none" ? -1 : Number(a[0]) - Number(b[0])))
                .map(([level, n]) => {
                  const cov = summary.proficiency.coverage_by_level[level];
                  return (
                    <span key={level}>
                      {level === "none" ? "sem HSK" : `HSK ${level}`}: {n}
                      {cov != null && <span className="text-slate-600"> ({Math.round(cov * 100)}%)</span>}
                    </span>
                  );
                })}
            </div>

            <div className="text-xs text-slate-400">
              Nível estimado:{" "}
              <span className="text-slate-200">
                {summary.proficiency.estimated_level > 0 ? `HSK ${summary.proficiency.estimated_level}` : "iniciante"}
              </span>
            </div>

            {summary.qualifier_shortage && (
              <p className="rounded-md bg-amber-400/10 px-3 py-2 text-xs text-amber-400">
                Poucos adjetivos no seu vocabulário — os textos vão sair descritivamente pobres. Vale estudar mais
                qualificadores.
              </p>
            )}

            <div className="max-h-96 overflow-y-auto rounded-md border border-white/5">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Palavra</th>
                    <th className="px-3 py-2">HSK</th>
                    <th className="px-3 py-2">Classe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(data?.profiles ?? []).map((profile) => (
                    <VocabularyRow key={profile.simplified} profile={profile} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </details>
  );
}

function VocabularyRow({ profile }: { profile: VocabularyProfile }) {
  const inHsk = profile.hsk_level != null;
  return (
    <tr className={inHsk ? "text-slate-200" : "text-amber-400/90"}>
      <td className="px-3 py-1.5">
        <span className="font-hanzi text-base">{profile.simplified}</span>
        {profile.pinyin && <span className="ml-2 text-xs text-slate-500">{profile.pinyin}</span>}
      </td>
      <td className="px-3 py-1.5 text-slate-400">{profile.hsk_level ?? "—"}</td>
      <td className="px-3 py-1.5 text-xs text-slate-300">
        {profile.pos_categories.map((category) => vocabularyCategoryLabel(category)).join(" · ") || "—"}
      </td>
    </tr>
  );
}
