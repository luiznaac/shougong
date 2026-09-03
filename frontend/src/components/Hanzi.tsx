/**
 * Renders a hanzi string on one line, scaling the glyph size down for
 * multi-character words so it never wraps or overflows its box.
 */
export function Hanzi({
  text,
  singleCharPx,
  boxPx,
  className = "",
}: {
  text: string;
  /** font-size (px) used when the string is a single character */
  singleCharPx: number;
  /** width (px) the string must fit within; longer strings scale down to fit */
  boxPx: number;
  className?: string;
}) {
  const n = Math.max(1, [...text].length);
  const size = Math.min(singleCharPx, (boxPx * 0.92) / n);
  return (
    <span
      lang="zh-Hans"
      className={`font-hanzi leading-none whitespace-nowrap ${className}`}
      style={{ fontSize: `${size}px` }}
    >
      {text}
    </span>
  );
}
