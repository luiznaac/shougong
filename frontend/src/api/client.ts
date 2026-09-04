import type {
  BatchImportResponse,
  BatchImportRowRequest,
  CharacterStrokes,
  DictionaryEntry,
  ReviewResult,
  ReviewLog,
  SrsRating,
  StudyItem,
  StudyItemHistory,
} from "./types.ts";

const BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

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
  searchDictionary(q: string, limit = 20): Promise<DictionaryEntry[]> {
    return request(`/dictionary-entries?q=${encodeURIComponent(q)}&limit=${limit}`);
  },
  getDictionaryEntry(id: number): Promise<DictionaryEntry> {
    return request(`/dictionary-entries/${id}`);
  },

  // --- strokes ---
  getCharacterStrokes(character: string): Promise<CharacterStrokes> {
    return request(`/characters/${encodeURIComponent(character)}/strokes`);
  },

  // --- study items ---
  listStudyItems(opts: { due?: boolean; limit?: number; offset?: number } = {}): Promise<StudyItem[]> {
    // Backend caps limit at 200; page through when more are needed.
    const pageSize = Math.min(opts.limit ?? 200, 200);
    const p = new URLSearchParams();
    if (opts.due) p.set("due", "true");
    p.set("limit", String(pageSize));
    if (opts.offset) p.set("offset", String(opts.offset));
    return request(`/study-items?${p}`);
  },
  async listAllStudyItems(opts: { due?: boolean } = {}): Promise<StudyItem[]> {
    const all: StudyItem[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await api.listStudyItems({ due: opts.due, limit: 200, offset });
      all.push(...page);
      if (page.length < 200) break;
    }
    return all;
  },
  getStudyItem(id: number): Promise<StudyItem> {
    return request(`/study-items/${id}`);
  },
  addStudyItem(dictionaryEntryId: number): Promise<StudyItem> {
    return request(`/study-items`, {
      method: "POST",
      body: JSON.stringify({ dictionary_entry_id: dictionaryEntryId }),
    });
  },
  batchImportStudyItems(rows: BatchImportRowRequest[]): Promise<BatchImportResponse> {
    return request(`/study-items/batch`, {
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
  listReviews(id: number, limit = 50): Promise<ReviewLog[]> {
    return request(`/study-items/${id}/reviews?limit=${limit}`);
  },
  listHistory(id: number, limit = 200): Promise<StudyItemHistory[]> {
    return request(`/study-items/${id}/history?limit=${limit}`);
  },
  /** Every item's learning→review transition row, paged through in full. */
  async listLearningToReviewHistory(): Promise<StudyItemHistory[]> {
    const all: StudyItemHistory[] = [];
    for (let offset = 0; ; offset += 200) {
      const page = await request<StudyItemHistory[]>(
        `/study-items/history/learning-to-review?limit=200&offset=${offset}`,
      );
      all.push(...page);
      if (page.length < 200) break;
    }
    return all;
  },
};
