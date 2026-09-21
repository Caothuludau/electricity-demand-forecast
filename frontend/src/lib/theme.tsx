/** Theme mode: dark (default operations look) or light. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";

interface ThemeCtx {
  mode: ThemeMode;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ mode: "dark", toggle: () => {} });

function initialMode(): ThemeMode {
  const fromUrl = new URLSearchParams(window.location.search).get("theme");
  if (fromUrl === "light" || fromUrl === "dark") return fromUrl;
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(mode);
    window.localStorage.setItem("theme", mode);
  }, [mode]);

  const toggle = useCallback(
    () => setMode((m) => (m === "dark" ? "light" : "dark")),
    [],
  );

  return <Ctx.Provider value={{ mode, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
