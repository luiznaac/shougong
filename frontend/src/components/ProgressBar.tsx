/**
 * The one proportional meter: a quiet track with a caller-coloured fill sized by
 * a 0..1 value. Both Progresso panel bodies use it, so the bar markup and its
 * clamping live in one place.
 */
export function ProgressBar({
  value,
  className = "bg-accent-500",
}: {
  value: number;
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, value * 100));
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-white/5">
      <span className={`block h-full rounded-full ${className}`} style={{ width: `${percent}%` }} />
    </span>
  );
}
