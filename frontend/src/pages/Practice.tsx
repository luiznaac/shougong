import { Link, useSearchParams } from "react-router-dom";
import { useExtraStudy } from "../api/queries.ts";
import { FullScreenMsg } from "../components/FullScreenMsg.tsx";
import { Quiz } from "../components/Quiz.tsx";
import { parsePracticeSearch } from "../lib/extraStudy.ts";

/**
 * Full-screen practice run launched by Extra Study. The bucket and instant
 * range travel in the URL; the page re-reads the same insight query the
 * dashboard used and holds it indefinitely, so the run's order is frozen. The
 * quiz runs with `record={false}`, so it issues no write request at all.
 */
export function Practice() {
  const [searchParams] = useSearchParams();
  const practice = parsePracticeSearch(searchParams);
  const { data, isLoading, error } = useExtraStudy(practice?.from ?? "", practice?.to ?? "", {
    staleTime: Number.POSITIVE_INFINITY,
    enabled: practice !== null,
  });

  if (!practice) {
    return (
      <FullScreenMsg text="Prática inválida — volte ao painel e escolha um período." tone="error">
        <Link to="/" className="text-sm text-slate-300 underline hover:text-white">
          Voltar ao painel
        </Link>
      </FullScreenMsg>
    );
  }
  if (isLoading) return <FullScreenMsg text="Carregando prática…" />;
  if (error) return <FullScreenMsg text={`Falha ao carregar: ${String(error)}`} tone="error" />;

  return (
    <Quiz
      items={data?.[practice.bucket].items ?? []}
      mode="review"
      record={false}
      emptyMessage="Nada para praticar neste período."
    />
  );
}
