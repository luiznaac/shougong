import type { ReactNode } from "react";

/** One centred full-screen message for the chrome-less lesson/review/practice flows. */
export function FullScreenMsg({
  text,
  tone,
  children,
}: {
  text: string;
  tone?: "error";
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center">
      <p className={tone === "error" ? "text-rose-400" : "text-slate-400"}>{text}</p>
      {children}
    </div>
  );
}
