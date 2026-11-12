import { Navigate, useLocation } from "react-router-dom";
import { useStudyOverview } from "../api/queries.ts";
import { CsvImportPanel } from "../components/CsvImportPanel.tsx";
import { DictionarySearchPanel } from "../components/DictionarySearchPanel.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { Icon } from "../components/icons.tsx";
import { PATHS } from "../lib/navigation.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";

/**
 * Biblioteca's Add/Import workspace. Desktop pairs dictionary search with CSV
 * import in one two-pane workspace and one queue counter; mobile keeps the
 * search-only pane and explains that CSV import lives on desktop.
 */
export function AddImport() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const location = useLocation();
  const overview = useStudyOverview();
  const queued = overview.data?.item_count ?? 0;

  // CSV import is desktop-only: a direct mobile visit falls back to Adicionar.
  if (!isDesktop && location.pathname === PATHS.bibliotecaImportar) {
    return <Navigate to={PATHS.bibliotecaAdicionar} replace />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca · Adicionar"
        title="Adicionar à biblioteca"
        summary={
          <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
            <Icon name="layers" size={16} className="text-accent-400" />
            {overview.isLoading ? (
              <Skeleton className="h-3 w-8" />
            ) : overview.error ? (
              <span className="text-slate-500">fila indisponível</span>
            ) : (
              <span className="tabular-nums text-slate-200">{`${queued} na fila`}</span>
            )}
          </span>
        }
      />

      {isDesktop ? (
        <div className="grid items-start gap-5 md:grid-cols-[1.35fr_1fr]">
          <DictionarySearchPanel key="desktop" presentation="desktop" />
          <CsvImportPanel />
        </div>
      ) : (
        <div className="space-y-4">
          <DictionarySearchPanel key="mobile" presentation="mobile" />
          <p className="rounded-xl border border-white/5 bg-slate-900/30 px-3 py-2 text-xs leading-relaxed text-slate-500">
            A importação de CSV está disponível apenas no desktop.
          </p>
        </div>
      )}
    </div>
  );
}
