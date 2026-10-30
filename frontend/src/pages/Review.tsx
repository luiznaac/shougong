import { useStudySession } from "../api/queries.ts";
import { Quiz } from "../components/Quiz.tsx";

export function Review() {
  // The backend selects the due, non-learning items and freezes one shuffle for
  // the whole run.
  const { data, isLoading, error } = useStudySession("review");

  if (isLoading) return <FullScreenMsg text="Carregando fila…" />;
  if (error) return <FullScreenMsg text={`Falha ao carregar: ${String(error)}`} tone="error" />;

  return (
    <Quiz items={data?.items ?? []} mode="review" emptyMessage="Nenhum item para revisar agora." />
  );
}

function FullScreenMsg({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className={tone === "error" ? "text-rose-400" : "text-slate-400"}>{text}</p>
    </div>
  );
}
