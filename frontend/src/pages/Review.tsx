import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import { Quiz } from "../components/Quiz.tsx";

export function Review() {
  // Snapshot the queue once, on entry. Only items already in `review`/`relearning`
  // — brand-new `learning` items go through the lesson flow instead.
  const { data, isLoading, error } = useQuery({
    queryKey: ["review-queue"],
    queryFn: async () => {
      const due = await api.listAllStudyItems({ due: true });
      return due.filter((i) => i.card.state !== "learning");
    },
    staleTime: Infinity,
    gcTime: 0,
  });

  if (isLoading)
    return <FullScreenMsg text="Carregando fila…" />;
  if (error)
    return <FullScreenMsg text={`Falha ao carregar: ${String(error)}`} tone="error" />;

  return (
    <Quiz items={data ?? []} mode="review" emptyMessage="Nenhum item para revisar agora." />
  );
}

function FullScreenMsg({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <p className={tone === "error" ? "text-rose-400" : "text-slate-400"}>{text}</p>
    </div>
  );
}
