import { createContext, useContext, useEffect, useState } from "react";

export type Audience = "business" | "developer";

const AudienceContext = createContext<{ audience: Audience; setAudience: (a: Audience) => void }>({
  audience: "business",
  setAudience: () => {},
});

export function AudienceProvider({ children }: { children: React.ReactNode }) {
  const [audience, setAudienceState] = useState<Audience>("business");

  useEffect(() => {
    queueMicrotask(() => {
      const saved = localStorage.getItem("mgt_audience");
      if (saved === "business" || saved === "developer") setAudienceState(saved);
    });
  }, []);

  const setAudience = (a: Audience) => {
    setAudienceState(a);
    localStorage.setItem("mgt_audience", a);
  };

  return <AudienceContext.Provider value={{ audience, setAudience }}>{children}</AudienceContext.Provider>;
}

export function useAudience() {
  return useContext(AudienceContext);
}
