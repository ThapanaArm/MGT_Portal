import { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";
import { useMatch } from "react-router";

export type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

function resolveInitialTheme(): Theme {
  const saved = localStorage.getItem("mgt_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferredTheme, setPreferredTheme] = useState(resolveInitialTheme);
  const landingMatch = useMatch("/");
  const loginMatch = useMatch("/login");
  const forceDark = Boolean(landingMatch || loginMatch);
  const theme = forceDark ? "dark" : preferredTheme;

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    if (forceDark) return;
    const next = preferredTheme === "dark" ? "light" : "dark";
    localStorage.setItem("mgt_theme", next);
    setPreferredTheme(next);
  }, [forceDark, preferredTheme]);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

