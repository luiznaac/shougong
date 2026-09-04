import { useEffect, useRef } from "react";
import HanziWriter from "hanzi-writer";
import { useCharacterStrokes } from "../api/queries.ts";
import { allowedMistakes } from "../lib/localSettings.ts";

/**
 * Interactive stroke-order check for a single character: the user draws it
 * from memory (no outline hint), hanzi-writer grades each stroke against the
 * reference data we already fetch/cache ourselves (via `charDataLoader`, so
 * there's no second network round trip to a CDN). `onResult` fires exactly
 * once, with whether the total mistake count stayed within the tolerance for
 * this character's own stroke count.
 */
export function HandwritingQuiz({
  character,
  tolerancePercent,
  sizePx = 220,
  onResult,
}: {
  character: string;
  tolerancePercent: number;
  sizePx?: number;
  onResult: (passed: boolean) => void;
}) {
  const { data, isLoading, error } = useCharacterStrokes(character);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const sentRef = useRef(false);
  useEffect(() => {
    sentRef.current = false;
  }, [character]);

  // No stroke data for this character (e.g. punctuation) — skip it rather
  // than blocking the sequence, same as StrokeOrder.tsx hiding itself.
  useEffect(() => {
    if (error && !sentRef.current) {
      sentRef.current = true;
      onResultRef.current(true);
    }
  }, [error]);

  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !mountRef.current) return;

    const allowed = allowedMistakes(data.strokes.length, tolerancePercent);
    const writer = HanziWriter.create(mountRef.current, character, {
      width: sizePx,
      height: sizePx,
      padding: 12,
      showCharacter: false,
      showOutline: false,
      charDataLoader: (_char, onLoad) => onLoad(data),
    });

    writer.quiz({
      showHintAfterMisses: false, // strictly from-memory — no hint
      markStrokeCorrectAfterMisses: 3, // don't block forever on one stroke; misses still count
      onComplete: ({ totalMistakes }) => {
        if (sentRef.current) return;
        sentRef.current = true;
        onResultRef.current(totalMistakes <= allowed);
      },
    });

    const mountNode = mountRef.current;
    return () => {
      writer.cancelQuiz();
      mountNode.innerHTML = ""; // hanzi-writer has no public destroy(); clear its SVG manually
    };
  }, [data, character, tolerancePercent, sizePx]);

  if (isLoading) return <div style={{ width: sizePx, height: sizePx }} />;
  if (error || !data) return null;

  return <div ref={mountRef} style={{ width: sizePx, height: sizePx, touchAction: "none" }} className="rounded-lg bg-slate-800/40" />;
}
