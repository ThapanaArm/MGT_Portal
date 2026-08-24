"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dictionaries, type Locale } from "./i18n";

export type { Locale };

function lookup(dict: unknown, path: string): string {
  const value = path.split(".").reduce<unknown>((node, key) => {
    if (node && typeof node === "object" && key in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
  return typeof value === "string" ? value : path;
}

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: (path: string) => string }>({
  locale: "th",
  setLocale: () => {},
  t: (path) => path,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("th");

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("mgt_locale");
      if (saved === "th" || saved === "en") setLocaleState(saved);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("mgt_locale", l);
  }, []);

  const t = useCallback((path: string) => lookup(dictionaries[locale], path), [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
