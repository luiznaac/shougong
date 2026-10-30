import { useStudySession } from "../api/queries.ts";
import { Quiz } from "../components/Quiz.tsx";

export function Lesson() {
  // The backend selects every `learning` item and freezes the session order
  // (pinned first, shuffled remainder) for the whole run.
  const { data, isLoading, error } = useStudySession("lesson");

  if (isLoading) return <FullScreenMsg text="Carregando lição…" />;
  if (error) return <FullScreenMsg text={`Falha ao carregar: ${String(error)}`} tone="error" />;

  return (
    <Quiz items={data?.items ?? []} mode="lesson" emptyMessage="Nenhum item novo para aprender." />
  );
}

function FullScreenMsg({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className={tone === "error" ? "text-rose-400" : "text-slate-400"}>{text}</p>
    </div>
  );
}
