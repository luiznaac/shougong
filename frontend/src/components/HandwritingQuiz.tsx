import HanziWriter from "hanzi-writer";
import { useEffect, useRef } from "react";
import { useCharacterStrokes } from "../api/queries.ts";

/**
 * The interactive handwriting step's contract: one character drawn from memory.
 * The child reports completion, never pass/fail — the learner judges the result
 * in the reveal, not the stroke matcher.
 */
export interface HandwritingStepProps {
  character: string;
  sizePx?: number;
  onComplete: () => void;
}

/**
 * Interactive stroke-order self-check for a single character: the user draws it
 * from memory (no outline hint), hanzi-writer guides each stroke against the
 * reference data we already fetch/cache ourselves (via `charDataLoader`, so
 * there's no second network round trip to a CDN). The automatic hint appears
 * after 3 misses and the stroke is force-accepted on the 4th, so the hint is
 * reachable before the stroke is accepted. `onComplete` fires exactly once,
 * regardless of the mistake count.
 */
export function HandwritingQuiz({ character, sizePx = 220, onComplete }: HandwritingStepProps) {
  const { data, isLoading, error } = useCharacterStrokes(character);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const sentRef = useRef(false);
  const lastCharacterRef = useRef(character);

  // No stroke data for this character (e.g. punctuation) — skip it rather
  // than blocking the sequence, same as StrokeOrder.tsx hiding itself.
  useEffect(() => {
    if (error && !sentRef.current) {
      sentRef.current = true;
      onCompleteRef.current();
    }
  }, [error]);

  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastCharacterRef.current !== character) {
      lastCharacterRef.current = character;
      sentRef.current = false;
    }
    if (!data || !mountRef.current) return;

    const writer = HanziWriter.create(mountRef.current, character, {
      width: sizePx,
      height: sizePx,
      padding: 12,
      showCharacter: false,
      showOutline: false,
      charDataLoader: (_char, onLoad) => onLoad(data),
    });

    writer.quiz({
      showHintAfterMisses: 3, // reachable before the stroke is force-accepted
      markStrokeCorrectAfterMisses: 4,
      onComplete: () => {
        if (sentRef.current) return;
        sentRef.current = true;
        onCompleteRef.current();
      },
    });

    const mountNode = mountRef.current;
    return () => {
      writer.cancelQuiz();
      mountNode.innerHTML = ""; // hanzi-writer has no public destroy(); clear its SVG manually
    };
  }, [data, character, sizePx]);

  if (isLoading) return <div style={{ width: sizePx, height: sizePx }} />;
  if (error || !data) return null;

  return (
    <div
      ref={mountRef}
      style={{ width: sizePx, height: sizePx, touchAction: "none" }}
      className="rounded-lg bg-slate-800/40"
    />
  );
}
