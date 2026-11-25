import { useSearchParams } from "react-router-dom";
import { useStudySession } from "../api/queries.ts";
import { FullScreenMsg } from "../components/FullScreenMsg.tsx";
import { Quiz } from "../components/Quiz.tsx";
import { HandwritingPrototype } from "../components/prototype/HandwritingPrototype.tsx";

export function Review() {
  const [params] = useSearchParams();
  // PROTOTYPE — dev-only overlay; remove this branch with the prototype file.
  if (import.meta.env.DEV && params.has("variant")) {
    return <HandwritingPrototype />;
  }
  return <ReviewSession />;
}

function ReviewSession() {
  // The backend selects the due, non-learning items and freezes one shuffle for
  // the whole run.
  const { data, isLoading, error } = useStudySession("review");

  if (isLoading) return <FullScreenMsg text="Carregando fila…" />;
  if (error) return <FullScreenMsg text={`Falha ao carregar: ${String(error)}`} tone="error" />;

  return (
    <Quiz items={data?.items ?? []} mode="review" emptyMessage="Nenhum item para revisar agora." />
  );
}
