import { createContext, useContext, useEffect } from "react";
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

const LocaleContext = createContext<{ locale: Locale; t: (path: string) => string }>({
  locale: "en",
  t: (path) => path,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => { document.documentElement.lang = "en"; }, []);
  return <LocaleContext.Provider value={{ locale: "en", t: translate }}>{children}</LocaleContext.Provider>;
}

function translate(path: string) { return lookup(dictionaries.en, path); }

export function useLocale() {
  return useContext(LocaleContext);
}
