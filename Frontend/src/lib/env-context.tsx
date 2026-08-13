"use client";

import { createContext, useContext, useState } from "react";
import type { CredEnv } from "./types";

const EnvContext = createContext<{ env: CredEnv; setEnv: (e: CredEnv) => void }>({
  env: "sandbox",
  setEnv: () => {},
});

export function EnvProvider({ children }: { children: React.ReactNode }) {
  const [env, setEnv] = useState<CredEnv>("sandbox");
  return <EnvContext.Provider value={{ env, setEnv }}>{children}</EnvContext.Provider>;
}

export function useEnv() {
  return useContext(EnvContext);
}

export const ENV_HOST: Record<CredEnv, string> = {
  sandbox: "sandbox-api.megachem.co.th",
  production: "api.megachem.co.th",
};
