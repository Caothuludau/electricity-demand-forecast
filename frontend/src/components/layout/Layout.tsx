import { Activity, Database, Languages, LayoutDashboard, Moon, Sun } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { RiskBadge } from "@/components/metrics/MetricCard";
import { useOverview } from "@/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", labelKey: "nav.dashboard" as const, icon: LayoutDashboard, end: true },
  { to: "/data-drivers", labelKey: "nav.drivers" as const, icon: Database, end: false },
];

export function Layout() {
  const { data: overview } = useOverview();
  const { mode, toggle } = useTheme();
  const { t, locale, setLocale } = useI18n();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-6">
          <div className="flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-accent" />
            <div>
              <div className="text-sm font-semibold tracking-tight">Energy Demand Intelligence</div>
              <div className="text-[10px] tracking-wide text-text-muted uppercase">
                {t("header.subtitle")}
              </div>
            </div>
          </div>

          <nav className="ml-4 flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded px-3 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-surface-2 text-text-primary"
                      : "text-text-secondary hover:bg-surface hover:text-text-primary",
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-text-muted md:inline">
              {overview
                ? `${t("header.dataThrough")} ${new Date(overview.data_end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                : "…"}
            </span>
            {overview && <RiskBadge level={overview.risk_level} />}
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
              title={mode === "dark" ? "Light mode" : "Dark mode"}
              className="flex h-7 w-7 items-center justify-center rounded border border-border text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              {mode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "vi" : "en")}
              aria-label="Switch language"
              className="flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] font-semibold tracking-wide text-text-secondary transition-colors hover:border-accent hover:text-accent"
            >
              <Languages className="h-3.5 w-3.5" />
              {locale === "en" ? "VI" : "EN"}
            </button>
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-risk-low" />
              {t("header.live")}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-border py-3">
        <div className="mx-auto max-w-[1600px] px-6 text-[11px] text-text-muted">
          {t("footer.tagline")}
        </div>
      </footer>
    </div>
  );
}
