import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { applyCachedPriority, predictPriorityPosition } from "../lib/lessonQueue.ts";
import { STUDY_SESSION_QUERY, studySessionKey } from "../lib/studySession.ts";
import { type StudyItemListQuery, api } from "./client.ts";
import type {
  GenerateReadingRequest,
  PriorityEdge,
  SessionKind,
  SrsRating,
  StudyItem,
} from "./types.ts";

export const keys = {
  studyItemsPrefix: ["study-items"] as const,
  studyItems: (opts: StudyItemListQuery = {}) =>
    ["study-items", { due: opts.due ?? false, leech: opts.leech ?? false }] as const,
  studyItem: (id: number) => ["study-items", id] as const,
  reviews: (id: number) => ["study-items", id, "reviews"] as const,
  history: (id: number) => ["study-items", id, "history"] as const,
  dictionary: (q: string) => ["dictionary", q] as const,
  readingHistory: ["reading-texts"] as const,
  insightsPrefix: ["insights"] as const,
  extraStudy: (from: string, to: string) => ["insights", "extra-study", { from, to }] as const,
};

export interface ExtraStudyQueryOptions {
  staleTime?: number;
  enabled?: boolean;
}

export function useExtraStudy(from: string, to: string, opts: ExtraStudyQueryOptions = {}) {
  return useQuery({
    queryKey: keys.extraStudy(from, to),
    queryFn: () => api.getExtraStudy(from, to),
    staleTime: opts.staleTime,
    enabled: opts.enabled ?? true,
  });
}

export function useStudyItems(opts: StudyItemListQuery = {}) {
  return useQuery({
    queryKey: keys.studyItems(opts),
    queryFn: () => api.listAllStudyItems(opts),
  });
}

export function useStudyItem(id: number) {
  return useQuery({
    queryKey: keys.studyItem(id),
    queryFn: () => api.getStudyItem(id),
  });
}

export function useStudySession(kind: SessionKind) {
  return useQuery({
    queryKey: studySessionKey(kind),
    queryFn: () => api.getStudySession(kind),
    ...STUDY_SESSION_QUERY,
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

export function useCharacterStrokes(character: string) {
  return useQuery({
    queryKey: ["strokes", character],
    queryFn: () => api.getCharacterStrokes(character),
    enabled: character.length > 0,
    retry: false, // a 404 means "no stroke data for this char" — a permanent, expected outcome
    staleTime: Number.POSITIVE_INFINITY, // stroke data for a given character never changes
  });
}

export function useAddStudyItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dictionaryEntryId: number) => api.addStudyItem(dictionaryEntryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.studyItemsPrefix }),
  });
}

/** A real grade refreshes the study-item grids and both Extra Study buckets. */
export function invalidateAfterReview(qc: QueryClient, id: number): void {
  qc.invalidateQueries({ queryKey: keys.studyItemsPrefix });
  qc.invalidateQueries({ queryKey: keys.insightsPrefix });
  qc.invalidateQueries({ queryKey: keys.studyItem(id) });
  qc.invalidateQueries({ queryKey: keys.reviews(id) });
}

export function useReviewMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating }: { id: number; rating: SrsRating }) =>
      api.reviewStudyItem(id, rating),
    onSuccess: (_res, { id }) => invalidateAfterReview(qc, id),
  });
}

interface PriorityVariables {
  id: number;
  edge: PriorityEdge | null;
}

interface PriorityMutationContext {
  snapshot: [QueryKey, unknown][];
}

export function priorityMutationOptions(qc: QueryClient) {
  return {
    mutationFn: ({ id, edge }: PriorityVariables): Promise<StudyItem | undefined> =>
      edge
        ? api.prioritiseStudyItem(id, edge)
        : api.deprioritiseStudyItem(id).then(() => undefined),
    onMutate: async ({ id, edge }: PriorityVariables): Promise<PriorityMutationContext> => {
      await qc.cancelQueries({ queryKey: keys.studyItemsPrefix });
      const snapshot = qc.getQueriesData({
        queryKey: keys.studyItemsPrefix,
      }) as [QueryKey, unknown][];
      const lists = snapshot
        .map(([, data]) => data)
        .filter((data): data is StudyItem[] => Array.isArray(data));
      const position = edge === null ? null : predictPriorityPosition(lists, edge);
      qc.setQueriesData({ queryKey: keys.studyItemsPrefix }, (data) =>
        applyCachedPriority(data, id, position),
      );
      return { snapshot };
    },
    onError: (
      _error: unknown,
      _variables: PriorityVariables,
      context: PriorityMutationContext | undefined,
    ) => {
      for (const [key, data] of context?.snapshot ?? []) qc.setQueryData(key, data);
    },
    onSuccess: (item: StudyItem | undefined) => {
      if (item) qc.setQueryData(keys.studyItem(item.id), item);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.studyItemsPrefix });
      qc.invalidateQueries({ queryKey: studySessionKey("lesson") });
    },
  };
}

export function usePriorityActions() {
  const qc = useQueryClient();
  const mutation = useMutation(priorityMutationOptions(qc));
  const run = (id: number, edge: PriorityEdge | null) => {
    mutation.reset();
    mutation.mutate({ id, edge });
  };

  return {
    pinFront: (id: number) => run(id, "front"),
    pinBack: (id: number) => run(id, "back"),
    remove: (id: number) => run(id, null),
    pending: mutation.isPending,
    error: mutation.error,
    errorItemId: mutation.variables?.id ?? null,
  };
}

export function useReadingHistory() {
  return useQuery({
    queryKey: keys.readingHistory,
    queryFn: () => api.listReadingHistory(),
  });
}

export function useReadingModels() {
  return useQuery({
    queryKey: ["reading-texts", "models"],
    queryFn: () => api.listReadingModels(),
    staleTime: 5 * 60 * 1000, // the proxy's model list changes rarely
  });
}

export function useGenerateReading() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: GenerateReadingRequest) => api.generateReading(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.readingHistory }),
  });
}

const vocabularyKey = ["reading-vocabulary"] as const;

export function useVocabularyProfile() {
  return useQuery({
    queryKey: vocabularyKey,
    queryFn: () => api.getVocabularyProfile(),
  });
}

const readingTopicsKey = ["reading-topics"] as const;

export function useReadingTopics() {
  return useQuery({ queryKey: readingTopicsKey, queryFn: () => api.listReadingTopics() });
}

export function useAddReadingTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scenario: string) => api.addReadingTopic(scenario),
    onSuccess: () => qc.invalidateQueries({ queryKey: readingTopicsKey }),
  });
}

export function useSetReadingTopicActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; active: boolean }) =>
      api.setReadingTopicActive(args.id, args.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: readingTopicsKey }),
  });
}

export function useDeleteReadingTopic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteReadingTopic(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: readingTopicsKey }),
  });
}
