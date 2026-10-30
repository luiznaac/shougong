import { describe, expect, it } from "vitest";
import { STUDY_SESSION_QUERY, studySessionKey } from "./studySession.ts";

describe("studySessionKey", () => {
  it("sits outside the study-items prefix", () => {
    expect(studySessionKey("lesson")[0]).not.toBe("study-items");
    expect(studySessionKey("review")[0]).not.toBe("study-items");
  });

  it("keeps the two kinds apart", () => {
    expect(studySessionKey("lesson")).not.toEqual(studySessionKey("review"));
  });
});

describe("STUDY_SESSION_QUERY", () => {
  it("never refetches a running session", () => {
    expect(STUDY_SESSION_QUERY.staleTime).toBe(Number.POSITIVE_INFINITY);
  });

  it("drops the session from the cache on unmount", () => {
    expect(STUDY_SESSION_QUERY.gcTime).toBe(0);
  });
});
