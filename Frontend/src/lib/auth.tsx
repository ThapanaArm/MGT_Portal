"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import type { UserDto } from "./types";

interface LoginResponse {
  token: string;
  user: UserDto;
}

interface AuthContextValue {
  user: UserDto | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  hasScope: (scope: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => {
      const raw = localStorage.getItem("mgt_user") || sessionStorage.getItem("mgt_user");
      const token = localStorage.getItem("mgt_token") || sessionStorage.getItem("mgt_token");
      if (raw && token) {
        try {
          setUser(JSON.parse(raw));
        } catch {
          /* ignore corrupt cache */
        }
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember = true) => {
      const res = await api.post<LoginResponse>("/api/auth/login", { email, password });
      // "Remember me" decides whether the session survives closing the browser
      // (localStorage) or ends with the tab (sessionStorage).
      const store = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      other.removeItem("mgt_token");
      other.removeItem("mgt_user");
      store.setItem("mgt_token", res.token);
      store.setItem("mgt_user", JSON.stringify(res.user));
      setUser(res.user);
      router.push("/ecosystem");
    },
    [router]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("mgt_token");
    localStorage.removeItem("mgt_user");
    sessionStorage.removeItem("mgt_token");
    sessionStorage.removeItem("mgt_user");
    setUser(null);
    router.push("/login");
  }, [router]);

  const hasScope = useCallback(
    (scope: string) => {
      if (!user) return false;
      return user.scopes.includes("*") || user.scopes.includes(scope);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasScope }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
