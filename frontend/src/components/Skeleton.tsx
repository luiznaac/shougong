/**
 * A decorative loading block. `motion-safe` keeps the pulse off for learners who
 * asked for reduced motion; the size comes from the caller's className.
 */
export function Skeleton({ className = "h-4 w-24" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block motion-safe:animate-pulse rounded bg-white/10 ${className}`}
    />
  );
}
