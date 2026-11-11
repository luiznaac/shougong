import {
  type QueryClient,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { applyCachedPriority, predictPriorityPosition } from "../lib/lessonQueue.ts";
import type { ItemPageRequest } from "../lib/pagination.ts";
import { STUDY_SESSION_QUERY, studySessionKey } from "../lib/studySession.ts";
import { api } from "./client.ts";
import type {
  GenerateReadingRequest,
  PriorityEdge,
  SessionKind,
  SrsRating,
  StudyItem,
  StudyItemListQuery,
} from "./types.ts";

export const keys = {
  studyItemsPrefix: ["study-items"] as const,
  studyItems: (opts: StudyItemListQuery = {}) => ["study-items", opts] as const,
  studyItemPages: (opts: StudyItemListQuery, limit: number) =>
    ["study-items", "page", { ...opts, limit }] as const,
  studyItemPageQuery: (opts: StudyItemListQuery, limit: number, offset: number) =>
    ["study-items", "page", { ...opts, limit, offset }] as const,
  studyItem: (id: number) => ["study-items", id] as const,
  reviews: (id: number) => ["study-items", id, "reviews"] as const,
  history: (id: number) => ["study-items", id, "history"] as const,
  dictionary: (q: string) => ["dictionary", q] as const,
  relatedEntries: (id: number, limit: number, offset: number) =>
    ["dictionary", "related", id, { limit, offset }] as const,
  readingHistoryPrefix: ["reading-texts"] as const,
  readingHistory: (limit = 20, offset = 0) => ["reading-texts", "list", { limit, offset }] as const,
  readingText: (id: number) => ["reading-texts", "detail", id] as const,
  insightsPrefix: ["insights"] as const,
  extraStudy: (from: string, to: string) => ["insights", "extra-study", { from, to }] as const,
  studyOverviewPrefix: ["study-overview"] as const,
  studyOverview: (tzOffsetMinutes: number) => ["study-overview", { tzOffsetMinutes }] as const,
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

export function useStudyOverview(tzOffsetMinutes = -new Date().getTimezoneOffset()) {
  return useQuery({
    queryKey: keys.studyOverview(tzOffsetMinutes),
    queryFn: () => api.getStudyOverview(tzOffsetMinutes),
  });
}

export function useStudyItems(opts: StudyItemListQuery = {}) {
  return useQuery({
    queryKey: keys.studyItems(opts),
    queryFn: () => api.listAllStudyItems(opts),
  });
}

/**
 * One page at a time from the study-item list, accumulating as the learner asks
 * for more. The server owns the order; `total` comes from the last envelope.
 */
export function useStudyItemPages(opts: StudyItemListQuery, limit: number) {
  return useInfiniteQuery({
    queryKey: keys.studyItemPages(opts, limit),
    queryFn: ({ pageParam }) => api.listStudyItems({ ...opts, limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      const next = lastPageParam + lastPage.items.length;
      return lastPage.items.length > 0 && next < lastPage.total ? next : undefined;
    },
  });
}

export function useStudyItem(id: number) {
  return useQuery({
    queryKey: keys.studyItem(id),
    queryFn: () => api.getStudyItem(id),
  });
}

/**
 * The item index's server pages. Desktop asks for its one page; mobile asks for
 * every 24-row page it has shown so far, so "Carregar mais" never exceeds the
 * server's 100-row cap and the page order stays authoritative. A page or filter
 * change has no placeholder rows, so the panel shows its own loading state
 * instead of a caption that overstates what is rendered.
 */
export function useStudyItemPageQueries(opts: StudyItemListQuery, requests: ItemPageRequest[]) {
  return useQueries({
    queries: requests.map((request) => ({
      queryKey: keys.studyItemPageQuery(opts, request.limit, request.offset),
      queryFn: () => api.listStudyItems({ ...opts, ...request }),
    })),
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

export function useDictionarySearch(q: string, limit = 20) {
  return useQuery({
    queryKey: ["dictionary", q, limit],
    // The envelope's total is available for the redesign; today's pages consume rows only.
    queryFn: async () => (await api.searchDictionary(q, limit)).items,
    enabled: q.trim().length > 0,
  });
}

export function useRelatedEntries(entryId: number, limit = 8, offset = 0) {
  return useQuery({
    queryKey: keys.relatedEntries(entryId, limit, offset),
    queryFn: () => api.listRelatedEntries(entryId, limit, offset),
    enabled: entryId > 0,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.studyItemsPrefix });
      qc.invalidateQueries({ queryKey: keys.studyOverviewPrefix });
    },
  });
}

/** A real grade refreshes the study-item grids, the overview and both Extra Study buckets. */
export function invalidateAfterReview(qc: QueryClient, id: number): void {
  qc.invalidateQueries({ queryKey: keys.studyItemsPrefix });
  qc.invalidateQueries({ queryKey: keys.insightsPrefix });
  qc.invalidateQueries({ queryKey: keys.studyOverviewPrefix });
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

export function useReadingHistory(limit = 20, offset = 0) {
  return useQuery({
    queryKey: keys.readingHistory(limit, offset),
    queryFn: () => api.listReadingHistory(limit, offset),
  });
}

export function useReadingText(id: number | null) {
  return useQuery({
    queryKey: keys.readingText(id ?? 0),
    queryFn: () => api.getReading(id ?? 0),
    enabled: id !== null,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.readingHistoryPrefix }),
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
