import type {
  BatchImportResponse,
  BatchImportRowRequest,
  CharacterStrokes,
  DictionaryEntry,
  ExtraStudy,
  GenerateReadingRequest,
  Page,
  PriorityEdge,
  ReadingSummaryPage,
  ReadingTopic,
  RelatedEntriesPage,
  ReviewLog,
  ReviewResult,
  SavedReadingText,
  SessionKind,
  SrsRating,
  StudyItem,
  StudyItemHistory,
  StudyItemListQuery,
  StudyOverview,
  StudySession,
  VocabularyOverview,
} from "./types.ts";

const BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

interface PageRequest {
  limit?: number;
  offset?: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON body */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // --- dictionary ---
  searchDictionary(q: string, limit = 20, offset = 0): Promise<Page<DictionaryEntry>> {
    const p = new URLSearchParams({ q, limit: String(limit) });
    if (offset) p.set("offset", String(offset));
    return request(`/dictionary-entries?${p}`);
  },
  getDictionaryEntry(id: number): Promise<DictionaryEntry> {
    return request(`/dictionary-entries/${id}`);
  },
  listRelatedEntries(entryId: number, limit = 8, offset = 0): Promise<RelatedEntriesPage> {
    return request(`/dictionary-entries/${entryId}/related?limit=${limit}&offset=${offset}`);
  },

  // --- strokes ---
  getCharacterStrokes(character: string): Promise<CharacterStrokes> {
    return request(`/characters/${encodeURIComponent(character)}/strokes`);
  },

  // --- study items ---
  listStudyItems(opts: StudyItemListQuery & PageRequest = {}): Promise<Page<StudyItem>> {
    const p = new URLSearchParams();
    if (opts.due) p.set("due", "true");
    if (opts.leech) p.set("leech", "true");
    for (const state of opts.state ?? []) p.append("state", state);
    for (const level of opts.hsk_level ?? []) p.append("hsk_level", String(level));
    for (const tag of opts.pos_tag ?? []) p.append("pos_tag", tag);
    if (opts.search) p.set("search", opts.search);
    if (opts.due_from) p.set("due_from", opts.due_from);
    if (opts.due_to) p.set("due_to", opts.due_to);
    if (opts.sort) p.set("sort", opts.sort);
    p.set("limit", String(Math.min(opts.limit ?? 20, 100)));
    if (opts.offset) p.set("offset", String(opts.offset));
    return request(`/study-items?${p}`);
  },
  async listAllStudyItems(opts: StudyItemListQuery = {}): Promise<StudyItem[]> {
    const all: StudyItem[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await api.listStudyItems({ ...opts, limit: 100, offset });
      all.push(...page.items);
      if (page.items.length < 100 || all.length >= page.total) break;
    }
    return all;
  },
  getStudyItem(id: number): Promise<StudyItem> {
    return request(`/study-items/${id}`);
  },
  addStudyItem(dictionaryEntryId: number): Promise<StudyItem> {
    return request("/study-items", {
      method: "POST",
      body: JSON.stringify({ dictionary_entry_id: dictionaryEntryId }),
    });
  },
  batchImportStudyItems(rows: BatchImportRowRequest[]): Promise<BatchImportResponse> {
    return request("/study-items/batch", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  },
  reviewStudyItem(id: number, rating: SrsRating): Promise<ReviewResult> {
    return request(`/study-items/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    });
  },
  prioritiseStudyItem(id: number, position: PriorityEdge): Promise<StudyItem> {
    return request(`/study-items/${id}/priority`, {
      method: "POST",
      body: JSON.stringify({ position }),
    });
  },
  deprioritiseStudyItem(id: number): Promise<void> {
    return request(`/study-items/${id}/priority`, { method: "DELETE" });
  },
  listReviews(id: number, limit = 50): Promise<ReviewLog[]> {
    return request(`/study-items/${id}/reviews?limit=${limit}`);
  },
  listHistory(id: number, limit = 200): Promise<StudyItemHistory[]> {
    return request(`/study-items/${id}/history?limit=${limit}`);
  },
  // --- study sessions ---
  getStudySession(kind: SessionKind): Promise<StudySession> {
    return request(`/study/session?kind=${kind}`);
  },

  // --- insights ---
  getExtraStudy(from: string, to: string): Promise<ExtraStudy> {
    const params = new URLSearchParams({ from, to });
    return request(`/study/insights/extra-study?${params}`);
  },
  getStudyOverview(tzOffsetMinutes = 0): Promise<StudyOverview> {
    const params = new URLSearchParams({ tz_offset_minutes: String(tzOffsetMinutes) });
    return request(`/study/overview?${params}`);
  },

  // --- reading ---
  generateReading(req: GenerateReadingRequest): Promise<SavedReadingText> {
    return request("/reading-texts", { method: "POST", body: JSON.stringify(req) });
  },
  listReadingHistory(limit = 20, offset = 0, entryId?: number): Promise<ReadingSummaryPage> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (entryId !== undefined) params.set("entry_id", String(entryId));
    return request(`/reading-texts?${params}`);
  },
  listReadingsByEntry(entryId: number, limit = 8, offset = 0): Promise<ReadingSummaryPage> {
    return api.listReadingHistory(limit, offset, entryId);
  },
  getReading(id: number): Promise<SavedReadingText> {
    return request(`/reading-texts/${id}`);
  },
  listReadingModels(): Promise<string[]> {
    return request("/reading-texts/models");
  },

  // --- reading vocabulary overview ---
  getVocabularyProfile(): Promise<VocabularyOverview> {
    return request("/reading-vocabulary");
  },

  // --- reading topic scenarios ---
  listReadingTopics(): Promise<ReadingTopic[]> {
    return request("/reading-topics");
  },
  addReadingTopic(scenario: string): Promise<ReadingTopic> {
    return request("/reading-topics", { method: "POST", body: JSON.stringify({ scenario }) });
  },
  setReadingTopicActive(id: number, active: boolean): Promise<ReadingTopic> {
    return request(`/reading-topics/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
  },
  deleteReadingTopic(id: number): Promise<void> {
    return request(`/reading-topics/${id}`, { method: "DELETE" });
  },
};
