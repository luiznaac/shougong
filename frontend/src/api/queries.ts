import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client.ts";
import type { BatchImportRowRequest, SrsRating } from "./types.ts";

export const keys = {
  studyItems: (due?: boolean) => ["study-items", { due: due ?? false }] as const,
  studyItem: (id: number) => ["study-items", id] as const,
  reviews: (id: number) => ["study-items", id, "reviews"] as const,
  history: (id: number) => ["study-items", id, "history"] as const,
  dictionary: (q: string) => ["dictionary", q] as const,
};

export function useStudyItems(opts: { due?: boolean } = {}) {
  return useQuery({
    queryKey: keys.studyItems(opts.due),
    queryFn: () => api.listAllStudyItems({ due: opts.due }),
  });
}

export function useStudyItem(id: number) {
  return useQuery({
    queryKey: keys.studyItem(id),
    queryFn: () => api.getStudyItem(id),
  });
}

export function useReviewHistory(id: number) {
  return useQuery({
    queryKey: keys.reviews(id),
    queryFn: () => api.listReviews(id),
  });
}

export function useItemHistory(id: number) {
  return useQuery({
    queryKey: keys.history(id),
    queryFn: () => api.listHistory(id),
  });
}

export function useLearningToReviewHistory() {
  return useQuery({
    queryKey: ["study-items", "learning-to-review"],
    queryFn: () => api.listLearningToReviewHistory(),
  });
}

export function useDictionarySearch(q: string, limit = 20) {
  return useQuery({
    queryKey: ["dictionary", q, limit],
    queryFn: () => api.searchDictionary(q, limit),
    enabled: q.trim().length > 0,
  });
}

export function useAddStudyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dictionaryEntryId: number) => api.addStudyItem(dictionaryEntryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-items"] }),
  });
}

export function useBatchImportStudyItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: BatchImportRowRequest[]) => api.batchImportStudyItems(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-items"] }),
  });
}

export function useReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: SrsRating }) =>
      api.reviewStudyItem(id, rating),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: keys.studyItem(id) });
      qc.invalidateQueries({ queryKey: keys.reviews(id) });
    },
  });
}
