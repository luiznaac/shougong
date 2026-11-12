import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExtraStudy } from "../api/queries.ts";
import type { ExtraStudy } from "../api/types.ts";
import {
  EXTRA_STUDY_BUCKETS,
  type ExtraStudyBucket,
  type ExtraStudyRange,
  defaultRange,
  rangeInstants,
} from "../lib/extraStudy.ts";
import { CharacterTileGrid } from "./CharacterTileGrid.tsx";

const DASHBOARD_STALE_TIME = 60_000;
const MAX_PREVIEW_TILES = 4;

const TAB_LABEL: Record<ExtraStudyBucket, string> = {
  recent_mistakes: "Erros recentes",
  recently_learned: "Aprendidos recentemente",
};

const EMPTY_COPY: Record<ExtraStudyBucket, string> = {
  recent_mistakes: "Nenhum erro no período.",
  recently_learned: "Nada aprendido no período.",
};

/**
 * The dashboard's Extra Study panel: the two fixed buckets as tabs with their
 * server totals, at most four hanzi tiles of the active bucket and the Praticar
 * action. One range (the recent window) drives one insight request; the active
 * tab renders the server order verbatim.
 */
export function ExtraStudyPanel() {
  const navigate = useNavigate();
  const [now] = useState(() => new Date());
  const [range] = useState<ExtraStudyRange>(() => defaultRange(now));
  const [activeBucket, setActiveBucket] = useState<ExtraStudyBucket>("recent_mistakes");
  const instants = rangeInstants(range);
  const { data, isLoading, error } = useExtraStudy(instants.from, instants.to, {
    staleTime: DASHBOARD_STALE_TIME,
  });
  const practiceDisabled = (data?.[activeBucket].items.length ?? 0) === 0;

  return (
    <ExtraStudyView
      activeBucket={activeBucket}
      data={data}
      isLoading={isLoading}
      error={error}
      practiceDisabled={practiceDisabled}
      onBucketChange={setActiveBucket}
      onPractice={() => {
        if (practiceDisabled) return;
        const params = new URLSearchParams({
          bucket: activeBucket,
          from: instants.from,
          to: instants.to,
        });
        navigate(`/practice?${params}`);
      }}
    />
  );
}

export interface ExtraStudyViewProps {
  activeBucket: ExtraStudyBucket;
  data: ExtraStudy | undefined;
  isLoading: boolean;
  error: Error | null;
  practiceDisabled: boolean;
  onBucketChange: (bucket: ExtraStudyBucket) => void;
  onPractice: () => void;
}

/** Presentational half of the panel — markup-only tests render this directly. */
export function ExtraStudyView({
  activeBucket,
  data,
  isLoading,
  error,
  practiceDisabled,
  onBucketChange,
  onPractice,
}: ExtraStudyViewProps) {
  const id = useId();
  const active = data?.[activeBucket];
  const counts: Record<ExtraStudyBucket, number> = {
    recent_mistakes: data?.recent_mistakes.total ?? 0,
    recently_learned: data?.recently_learned.total ?? 0,
  };

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Estudo extra" className="flex flex-wrap gap-1">
        {EXTRA_STUDY_BUCKETS.map((bucket) => {
          const selected = bucket === activeBucket;
          return (
            <button
              key={bucket}
              type="button"
              role="tab"
              id={`${id}-tab-${bucket}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              onClick={() => onBucketChange(bucket)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected
                  ? "border-accent-500 bg-accent-500/15 text-accent-300"
                  : "border-white/10 text-slate-400 hover:text-slate-200"
              }`}
            >
              {TAB_LABEL[bucket]} ({counts[bucket]})
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${activeBucket}`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <p className="text-sm text-slate-400">Carregando estudo extra…</p>
            ) : error ? (
              <p className="text-sm text-rose-400">Falha ao carregar: {String(error)}</p>
            ) : !active || active.items.length === 0 ? (
              <p className="text-sm text-slate-500">{EMPTY_COPY[activeBucket]}</p>
            ) : (
              <CharacterTileGrid items={active.items.slice(0, MAX_PREVIEW_TILES)} />
            )}
          </div>
          <button
            type="button"
            onClick={onPractice}
            disabled={practiceDisabled}
            className="rounded-md bg-accent-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Praticar
          </button>
        </div>
      </div>
    </div>
  );
}
