import type { SessionKind } from "../api/types.ts";

export const studySessionKey = (kind: SessionKind) => ["study-session", kind] as const;

export const STUDY_SESSION_QUERY = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 0,
} as const;
