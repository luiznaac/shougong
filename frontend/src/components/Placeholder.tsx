import { Link } from "react-router-dom";
import { EmptyState } from "./EmptyState.tsx";
import { PageHeader } from "./PageHeader.tsx";
import { Panel } from "./Panel.tsx";

export interface PlaceholderLink {
  label: string;
  to: string;
}

/**
 * The one shared placeholder for a surface that has not migrated yet. Each
 * pending route renders this instead of its own stub page, so navigation can be
 * written once and each surface ticket replaces this component's usage outright.
 * A section index can point at its already-built sub-surfaces through `links`.
 */
export function Placeholder({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links?: PlaceholderLink[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Em construção" title={title} />
      <Panel>
        <EmptyState
          icon="spark"
          title="Esta superfície está a caminho"
          description={description}
          action={
            links?.length ? (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent-500 transition-colors hover:bg-white/5"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : undefined
          }
        />
      </Panel>
    </div>
  );
}
