"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { CurrentAppUser } from "@/lib/auth/types";

type CurrentUserContextValue = {
  user: CurrentAppUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CurrentUserContext = createContext<CurrentUserContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
});

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentAppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSession() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setUser(null);
        setError(data.message || "Sessão inválida.");
        return;
      }

      setUser(data.user ?? null);
    } catch {
      setUser(null);
      setError("Não foi possível carregar a sessão.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      refresh: loadSession,
    }),
    [error, loading, user],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(CurrentUserContext);
}
