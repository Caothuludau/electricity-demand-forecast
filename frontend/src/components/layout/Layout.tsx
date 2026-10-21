import { Activity, Moon, Sun } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/raw", label: "Raw data" },
  { to: "/processed", label: "Processed data" },
  { to: "/eda", label: "EDA" },
  { to: "/model", label: "Model" },
  { to: "/forecast", label: "Forecast" },
];

export function Layout() {
  const { mode, toggle } = useTheme();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Tetouan demand</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded px-2.5 py-1 text-[13px] whitespace-nowrap",
                    isActive ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:text-text-primary",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary"
          >
            {mode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
