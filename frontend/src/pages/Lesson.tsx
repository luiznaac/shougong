import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import { Quiz } from "../components/Quiz.tsx";

export function Lesson() {
  // Items still in `learning` — never successfully reviewed. Each is shown in
  // full first, then quizzed once.
  const { data, isLoading, error } = useQuery({
    queryKey: ["lesson-queue"],
    queryFn: async () => {
      const all = await api.listAllStudyItems();
      return all.filter((i) => i.card.state === "learning");
    },
    staleTime: Infinity,
    gcTime: 0,
  });

  if (isLoading) return <FullScreenMsg text="Carregando lição…" />;
  if (error)
    return <FullScreenMsg text={`Falha ao carregar: ${String(error)}`} tone="error" />;

  return (
    <Quiz items={data ?? []} mode="lesson" emptyMessage="Nenhum item novo para aprender." />
  );
}

function FullScreenMsg({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className={tone === "error" ? "text-rose-400" : "text-slate-400"}>{text}</p>
    </div>
  );
}
