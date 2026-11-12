import type {
  ReadingAttempt,
  ReadingFormat,
  ReadingSpeaker,
  ReadingSummary,
  ReadingToken,
  SavedReadingText,
} from "../api/types.ts";
import { readingFormatLabel } from "../i18n/readingFormat.ts";
import { workingSetGroupLabel } from "../i18n/workingSet.ts";
import { formatDateTime } from "../lib/format.ts";
import { keyedOccurrences } from "../lib/occurrenceKeys.ts";
import { EmptyState } from "./EmptyState.tsx";
import { Panel } from "./Panel.tsx";
import { PanelError } from "./QueryState.tsx";
import { Skeleton } from "./Skeleton.tsx";

interface ReadingMeta {
  id: number;
  format: ReadingFormat;
  model: string;
  topic: string | null;
  topicGenerated: boolean;
  attemptCount: number;
  tokenCount: number;
  createdAt: string;
}

function metaOf(reading: ReadingSummary | SavedReadingText): ReadingMeta {
  const tokenCount = "token_count" in reading ? reading.token_count : reading.tokens.length;
  return {
    id: reading.id,
    format: reading.format,
    model: reading.model,
    topic: reading.topic,
    topicGenerated: reading.topic_generated,
    attemptCount: reading.attempt_count,
    tokenCount,
    createdAt: reading.created_at,
  };
}

/**
 * The Leitura centre pane: the bounded article column, its meta line and the
 * extra-word note, plus the preserved attempt trail and offered-vocabulary
 * accordions. Every word is a lookup trigger, but the article is never covered
 * on desktop — the caller routes the selection to the rail inspector.
 */
export function ReadingArticle({
  summary,
  detail,
  isLoading,
  error,
  onRetry,
  onSelectToken,
}: {
  summary: ReadingSummary | null;
  detail: SavedReadingText | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onSelectToken: (token: ReadingToken) => void;
}) {
  if (!summary && !detail) {
    return (
      <Panel>
        <EmptyState
          icon="text"
          title="Nenhuma leitura selecionada"
          description="Escolha uma leitura no histórico ou gere uma nova."
        />
      </Panel>
    );
  }

  const meta = detail ? metaOf(detail) : summary ? metaOf(summary) : null;

  return (
    <Panel>
      <div className="mx-auto max-w-[68ch]">
        {meta ? <MetaLine meta={meta} /> : null}

        {isLoading && !detail ? (
          <div className="mt-4 space-y-3">
            <span className="sr-only">Carregando leitura…</span>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : error && !detail ? (
          <PanelError
            title="Não foi possível carregar esta leitura."
            error={error}
            onRetry={onRetry}
          />
        ) : detail ? (
          <>
            <div className="mt-4">
              <ReadingTokens
                tokens={detail.tokens}
                speakers={detail.speakers}
                onSelect={onSelectToken}
              />
            </div>

            {detail.extra_words.length > 0 ? (
              <p className="mt-4 text-xs text-amber-400">
                {detail.extra_words.length} palavra(s) fora do vocabulário conhecido.
              </p>
            ) : null}

            {detail.attempts.length > 1 ? <AttemptTrail attempts={detail.attempts} /> : null}
            {Object.keys(detail.working_set).length > 0 ? (
              <OfferedVocabulary workingSet={detail.working_set} mustUse={detail.must_use} />
            ) : null}
          </>
        ) : null}
      </div>
    </Panel>
  );
}

function MetaLine({ meta }: { meta: ReadingMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <span className="tabular-nums">#{meta.id}</span>
      <span>&middot;</span>
      <span>{readingFormatLabel(meta.format)}</span>
      {meta.model ? (
        <>
          <span>&middot;</span>
          <span className="font-mono">{meta.model}</span>
        </>
      ) : null}
      {meta.topic ? (
        <>
          <span>&middot;</span>
          <span className={meta.topicGenerated ? "italic" : ""}>
            {meta.topic}
            {meta.topicGenerated ? " (sorteado)" : ""}
          </span>
        </>
      ) : null}
      {meta.attemptCount > 1 ? (
        <>
          <span>&middot;</span>
          <span>{meta.attemptCount} tentativas</span>
        </>
      ) : null}
      {meta.tokenCount > 0 ? (
        <>
          <span>&middot;</span>
          <span className="tabular-nums">{meta.tokenCount.toLocaleString()} tokens</span>
        </>
      ) : null}
      <span className="ml-auto">{formatDateTime(meta.createdAt)}</span>
    </div>
  );
}

function AttemptTrail({ attempts }: { attempts: ReadingAttempt[] }) {
  return (
    <details className="mt-4 rounded-md border border-white/10 bg-slate-950/40">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Iterações ({attempts.length})
      </summary>
      <ol className="space-y-3 px-3 pb-3">
        {attempts.map((attempt) => {
          const flagged = new Set(attempt.extra_words);
          return (
            <li key={attempt.attempt} className="border-t border-white/5 pt-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>#{attempt.attempt}</span>
                {attempt.chosen ? (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                    escolhido
                  </span>
                ) : null}
                {attempt.extra_words.length > 0 ? (
                  <span className="text-amber-400">
                    {attempt.extra_words.length} fora do vocabulário:{" "}
                    {attempt.extra_words.join(" ")}
                  </span>
                ) : null}
                <span className="ml-auto">
                  {(attempt.prompt_tokens + attempt.completion_tokens).toLocaleString()} tokens
                </span>
              </div>
              {attempt.dialogue_problems.length > 0 ? (
                <p className="mt-1 text-xs text-amber-400">
                  {attempt.dialogue_problems.join(" · ")}
                </p>
              ) : null}
              <p
                lang="zh-Hans"
                className="font-hanzi mt-2 flex flex-wrap gap-x-1 gap-y-1 text-lg leading-snug"
              >
                {keyedOccurrences(attempt.segmentation, (segment) => segment).map(
                  ({ key, item: seg }) => (
                    <span
                      key={key}
                      className={
                        flagged.has(seg)
                          ? "rounded bg-amber-400/10 px-0.5 text-amber-400"
                          : "text-slate-300"
                      }
                    >
                      {seg}
                    </span>
                  ),
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function OfferedVocabulary({
  workingSet,
  mustUse,
}: {
  workingSet: Record<string, string[]>;
  mustUse: string[];
}) {
  const anchors = new Set(mustUse);
  return (
    <details className="mt-4 rounded-md border border-white/10 bg-slate-950/40">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Vocabulário oferecido
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {mustUse.length > 0 ? (
          <p className="text-xs text-slate-500">
            Âncoras: <span className="font-hanzi text-emerald-300">{mustUse.join(" ")}</span>
          </p>
        ) : null}
        {Object.entries(workingSet).map(([group, words]) => (
          <div key={group} className="text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {workingSetGroupLabel(group)}
            </span>
            <p lang="zh-Hans" className="font-hanzi mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
              {keyedOccurrences(words, (word) => word).map(({ key, item: word }) => (
                <span
                  key={key}
                  className={anchors.has(word) ? "text-emerald-300" : "text-slate-300"}
                >
                  {word}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function ReadingTokens({
  tokens,
  speakers,
  onSelect,
}: {
  tokens: ReadingToken[];
  speakers: ReadingSpeaker[];
  onSelect: (token: ReadingToken) => void;
}) {
  if (tokens.some((token) => token.speaker != null)) {
    return <DialogueView tokens={tokens} speakers={speakers} onSelect={onSelect} />;
  }
  return (
    <p
      lang="zh-Hans"
      className="font-hanzi whitespace-pre-wrap text-[26px] leading-[2.15] tracking-wide text-slate-100"
    >
      <TokenSpans tokens={tokens} onSelect={onSelect} />
    </p>
  );
}

function TokenSpans({
  tokens,
  onSelect,
}: {
  tokens: ReadingToken[];
  onSelect: (token: ReadingToken) => void;
}) {
  return (
    <>
      {keyedOccurrences(tokens, (token) => token.text).map(({ key, item: token }) =>
        token.is_word ? (
          <WordToken key={key} token={token} onSelect={onSelect} />
        ) : (
          <span key={key}>{token.text}</span>
        ),
      )}
    </>
  );
}

function DialogueView({
  tokens,
  speakers,
  onSelect,
}: {
  tokens: ReadingToken[];
  speakers: ReadingSpeaker[];
  onSelect: (token: ReadingToken) => void;
}) {
  const pinyinByName = new Map(speakers.map((speaker) => [speaker.name, speaker.pinyin]));
  const order = speakers.map((speaker) => speaker.name);

  // Group consecutive same-speaker runs; the "\n" separators between turns are dropped.
  const turns: { speaker: string; tokens: ReadingToken[] }[] = [];
  for (const token of tokens) {
    if (!token.is_word && token.text.trim() === "") continue;
    const speaker = token.speaker ?? "";
    const last = turns.at(-1);
    if (last && last.speaker === speaker) last.tokens.push(token);
    else turns.push({ speaker, tokens: [token] });
  }

  const seen = new Set<string>();
  return (
    <div className="space-y-3">
      {keyedOccurrences(turns, (turn) => turn.speaker).map(({ key, item: turn }) => {
        const left = order.indexOf(turn.speaker) % 2 === 0;
        const firstTime = !seen.has(turn.speaker);
        seen.add(turn.speaker);
        const pinyin = pinyinByName.get(turn.speaker);
        return (
          <div key={key} className={`flex flex-col ${left ? "items-start" : "items-end"}`}>
            <span className="mb-0.5 text-xs text-slate-500">
              <span className="font-hanzi">{turn.speaker}</span>
              {firstTime && pinyin ? <span className="ml-1">{pinyin}</span> : null}
            </span>
            <p
              lang="zh-Hans"
              className={`font-hanzi max-w-[80%] rounded-2xl px-3 py-2 text-xl leading-loose ${
                left ? "bg-slate-800" : "bg-accent-500/15"
              }`}
            >
              <TokenSpans tokens={turn.tokens} onSelect={onSelect} />
            </p>
          </div>
        );
      })}
    </div>
  );
}

function WordToken({
  token,
  onSelect,
}: {
  token: ReadingToken;
  onSelect: (token: ReadingToken) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className={`rounded px-0.5 outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 ${
        token.is_extra
          ? "text-amber-400 underline decoration-dotted underline-offset-4"
          : "text-slate-100"
      }`}
    >
      {token.text}
    </button>
  );
}
