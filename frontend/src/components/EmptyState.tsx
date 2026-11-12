import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons.tsx";

/**
 * The one empty state: an icon, a plain-language headline, guidance copy and an
 * optional action. Every panel carries its own empty copy rather than a blank
 * screen.
 */
export function EmptyState({
  title,
  description,
  icon = "spark",
  action,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon name={icon} size={28} className="text-slate-500" />
      <p className="text-sm font-medium text-slate-200">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}
