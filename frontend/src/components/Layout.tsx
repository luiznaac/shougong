import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
    isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200",
  ].join(" ");

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <NavLink to="/" className="mr-3 flex items-center gap-2">
            <span lang="zh-Hans" className="text-xl font-hanzi text-accent-500">
              手工
            </span>
            <span className="text-sm font-semibold tracking-wide text-slate-300">
              shougong
            </span>
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Painel
            </NavLink>
            <NavLink to="/add" className={linkClass}>
              Adicionar
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
