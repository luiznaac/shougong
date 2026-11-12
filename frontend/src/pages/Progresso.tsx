import { useStudyItemPages, useStudyOverview, useVocabularyProfile } from "../api/queries.ts";
import type { LearnedProgress, VocabularySummary } from "../api/types.ts";
import { HskCoverage } from "../components/HskCoverage.tsx";
import { ItemsLearnedChart } from "../components/ItemsLearnedChart.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Panel } from "../components/Panel.tsx";
import { PanelState } from "../components/QueryState.tsx";
import { RecentWords } from "../components/RecentWords.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { VocabularyBreakdown } from "../components/VocabularyBreakdown.tsx";
import { estimatedLevelLabel, hskCoverageRows } from "../lib/progress.ts";

const RECENT_LIMIT = 5;
const EMPTY_LEARNED: LearnedProgress = { total: 0, points: [] };

/**
 * Progresso: the HSK coverage and vocabulary profile from the vocabulary
 * aggregate, the cumulative learned curve from the study overview, and the most
 * recent words with their SRS stage. Every panel owns its loading, error and
 * empty state, and the panels stack into one column below `lg`.
 */
export function Progresso() {
  const vocabulary = useVocabularyProfile();
  const overview = useStudyOverview();
  const recent = useStudyItemPages({ sort: "created_desc" }, RECENT_LIMIT);

  const summary = vocabulary.data?.summary;
  const recentItems = recent.data?.pages[0]?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seu avanço"
        title="Progresso"
        summary={
          vocabulary.isLoading ? (
            <Skeleton className="h-7 w-36" />
          ) : summary ? (
            <span className="rounded-full bg-accent-500/15 px-3 py-1 text-xs font-semibold text-accent-300 ring-1 ring-accent-500/30">
              Nível estimado: {estimatedLevelLabel(summary.proficiency.estimated_level)}
            </span>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel title="Cobertura HSK" action={summaryAction(summary)}>
          <PanelState
            isLoading={vocabulary.isLoading}
            loadingLabel="Carregando cobertura HSK"
            loadingRows={5}
            skeletonClass="h-6 w-full"
            error={vocabulary.error}
            errorTitle="Não foi possível carregar a cobertura HSK."
            onRetry={() => vocabulary.refetch()}
          >
            <HskCoverage rows={summary ? hskCoverageRows(summary) : []} />
          </PanelState>
        </Panel>

        <Panel title="Perfil de vocabulário">
          <PanelState
            isLoading={vocabulary.isLoading}
            loadingLabel="Carregando perfil de vocabulário"
            loadingRows={4}
            skeletonClass="h-6 w-full"
            error={vocabulary.error}
            errorTitle="Não foi possível carregar o perfil de vocabulário."
            onRetry={() => vocabulary.refetch()}
          >
            {summary ? <VocabularyBreakdown summary={summary} /> : null}
          </PanelState>
        </Panel>

        <Panel title="Curva de aprendizado" className="lg:col-span-2">
          <PanelState
            isLoading={overview.isLoading}
            loadingLabel="Carregando curva de aprendizado"
            loadingRows={1}
            skeletonClass="h-44 w-full"
            error={overview.error}
            errorTitle="Não foi possível carregar a curva de aprendizado."
            onRetry={() => overview.refetch()}
          >
            <ItemsLearnedChart learned={overview.data?.learned ?? EMPTY_LEARNED} />
          </PanelState>
        </Panel>

        <Panel title="Palavras recentes" className="lg:col-span-2">
          <PanelState
            isLoading={recent.isLoading}
            loadingLabel="Carregando palavras recentes"
            loadingRows={3}
            skeletonClass="h-9 w-full"
            error={recent.error}
            errorTitle="Não foi possível carregar as palavras recentes."
            onRetry={() => recent.refetch()}
          >
            <RecentWords items={recentItems} />
          </PanelState>
        </Panel>
      </div>
    </div>
  );
}

function summaryAction(summary: VocabularySummary | undefined) {
  if (!summary) return null;
  return (
    <span className="text-[10px] text-slate-500">
      {summary.categorised} de {summary.total} no HSK
    </span>
  );
}
