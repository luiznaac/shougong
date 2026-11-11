// Throwaway neutral device frame (wayfinder ticket #105). Shared only for the
// bezel; every variant supplies its own mobile chrome and content inside.

import type { ReactNode } from "react";

export function PhoneFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="relative h-[700px] w-[352px] overflow-hidden rounded-[2.4rem] border-[10px] border-slate-800 bg-slate-950 shadow-2xl">
        <div className="absolute top-0 left-1/2 z-30 h-5 w-28 -translate-x-1/2 rounded-b-xl bg-slate-800" />
        <div className="h-full w-full overflow-y-auto">{children}</div>
      </div>
      <figcaption className="max-w-[352px] text-center text-xs text-slate-500">
        {caption}
      </figcaption>
    </figure>
  );
}
