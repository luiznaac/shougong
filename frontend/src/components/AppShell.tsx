import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStudyOverview } from "../api/queries.ts";
import {
  AJUSTES,
  MAIS_ITEMS,
  MOBILE_TABS,
  PATHS,
  SECTIONS,
  isActiveSection,
  isMaisTabActive,
} from "../lib/navigation.ts";
import { DOCKED_BOTTOM, SAFE_AREA_BOTTOM, SAFE_AREA_TOP } from "../lib/safeArea.ts";
import { Skeleton } from "./Skeleton.tsx";
import { Icon } from "./icons.tsx";

const desktopLinkClass = (active: boolean) =>
  [
    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
    active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200",
  ].join(" ");

const mobileTabClass = (active: boolean) =>
  [
    "flex min-h-11 flex-col items-center justify-center gap-0.5 py-1 transition-colors",
    active ? "text-accent-500" : "text-slate-400 hover:text-slate-200",
  ].join(" ");

function Brand() {
  return (
    <Link to={PATHS.hoje} className="flex shrink-0 items-center gap-2">
      <span lang="zh-Hans" className="font-hanzi text-xl text-accent-500">
        手工
      </span>
      <span className="text-sm font-semibold tracking-wide text-slate-300">shougong</span>
    </Link>
  );
}

function ResumeChip() {
  const { data, isLoading } = useStudyOverview();
  return (
    <Link
      to={PATHS.retomar}
      className="flex items-center gap-2 rounded-full bg-accent-500/15 px-3 py-1.5 text-xs font-semibold text-accent-300 ring-1 ring-accent-500/30 transition-colors hover:bg-accent-500/25"
    >
      <span>Retomar</span>
      {isLoading ? (
        <Skeleton className="h-3 w-4" />
      ) : (
        <span className="tabular-nums">{data?.due_count ?? 0}</span>
      )}
    </Link>
  );
}

function DesktopTopBar({ pathname }: { pathname: string }) {
  return (
    <header
      data-testid="desktop-top-bar"
      className="sticky top-0 z-40 hidden h-16 border-b border-white/10 bg-slate-950/80 backdrop-blur md:block"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center gap-6 px-6">
        <Brand />
        <nav aria-label="Seções" className="flex items-center gap-1">
          {SECTIONS.map((section) => {
            const active = isActiveSection(section.to, pathname);
            return (
              <Link
                key={section.id}
                to={section.to}
                aria-current={active ? "page" : undefined}
                className={desktopLinkClass(active)}
              >
                {section.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to={PATHS.biblioteca}
            aria-label="Buscar"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
          >
            <Icon name="search" size={16} />
            <span>Buscar</span>
            <kbd className="rounded border border-white/10 px-1 text-[10px] text-slate-500">⌘K</kbd>
          </Link>
          <ResumeChip />
          <Link
            to={AJUSTES.to}
            aria-label={AJUSTES.label}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 ring-1 ring-white/10 transition-colors hover:text-white"
          >
            <Icon name={AJUSTES.icon} size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileTopBar() {
  return (
    <header
      data-testid="mobile-top-bar"
      className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur md:hidden"
      style={{ paddingTop: SAFE_AREA_TOP }}
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Brand />
        <Link
          to={PATHS.biblioteca}
          aria-label="Buscar"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/5"
        >
          <Icon name="search" size={20} />
        </Link>
      </div>
    </header>
  );
}

function MaisSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/60 md:hidden"
      />
      <div
        id="mais-sheet"
        role="menu"
        aria-label="Mais"
        className="fixed inset-x-3 z-50 rounded-2xl bg-slate-900 p-2 shadow-xl ring-1 ring-white/10 md:hidden"
        style={{ bottom: DOCKED_BOTTOM }}
      >
        {MAIS_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            role="menuitem"
            onClick={onClose}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-slate-200 transition-colors hover:bg-white/5"
          >
            <Icon name={item.icon} size={18} className="text-slate-400" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}

function MobileTabBar({
  pathname,
  maisOpen,
  onToggleMais,
}: {
  pathname: string;
  maisOpen: boolean;
  onToggleMais: () => void;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      data-testid="mobile-tab-bar"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur md:hidden"
      style={{ paddingBottom: SAFE_AREA_BOTTOM }}
    >
      <div className="grid grid-cols-4">
        {MOBILE_TABS.map((tab) => {
          const active = isActiveSection(tab.to, pathname);
          return (
            <Link
              key={tab.id}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={mobileTabClass(active)}
            >
              <Icon name={tab.icon} size={20} />
              <span className="text-[9px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onToggleMais}
          aria-expanded={maisOpen}
          aria-controls="mais-sheet"
          aria-haspopup="menu"
          className={mobileTabClass(isMaisTabActive(pathname))}
        >
          <Icon name="more" size={20} />
          <span className="text-[9px] font-medium">Mais</span>
        </button>
      </div>
      <span
        aria-hidden="true"
        className="mx-auto mt-1 mb-1 block h-1 w-10 rounded-full bg-white/25"
      />
    </nav>
  );
}

/**
 * The app-wide responsive shell. Desktop gets the sticky command bar; mobile gets
 * the app bar and pinned bottom tabs with a Mais overflow sheet. The three
 * practice flows are routed outside it, so they never render this chrome.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [maisOpen, setMaisOpen] = useState(false);

  // ⌘K / Ctrl+K is the search affordance's promised shortcut.
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        navigate(PATHS.biblioteca);
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [navigate]);

  useEffect(() => {
    if (!maisOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMaisOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [maisOpen]);

  return (
    <div className="min-h-screen">
      <DesktopTopBar pathname={pathname} />
      <MobileTopBar />
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:px-6 md:pt-8 md:pb-8">
        <Outlet />
      </main>
      <MobileTabBar
        pathname={pathname}
        maisOpen={maisOpen}
        onToggleMais={() => setMaisOpen((open) => !open)}
      />
      {maisOpen ? <MaisSheet onClose={() => setMaisOpen(false)} /> : null}
    </div>
  );
}
