import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const DEV_USER = {
  id: "dev-free-entry-user",
  email: "dev@growmedica.sk",
  app_metadata: { provider: "dev" },
  user_metadata: { full_name: "Dev Free Entry User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

type Provider = "google" | "apple";

type Ctx = {
  user: User | null;
  loading: boolean;
  signInWithProvider: (provider: Provider) => Promise<void>;
  signInDev: () => void;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("gm_dev_auth") === "true") {
      setUser(DEV_USER);
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      loading,
      signInWithProvider: async (provider) => {
        const res = await lovable.auth.signInWithOAuth(provider, {
          redirect_uri: `${window.location.origin}/admin`,
        });
        if (res.error) throw res.error;
      },
      signInDev: () => {
        if (typeof window !== "undefined") {
          localStorage.setItem("gm_dev_auth", "true");
        }
        setUser(DEV_USER);
      },
      signOut: async () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("gm_dev_auth");
        }
        await supabase.auth.signOut();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- useAuth belongs next to AuthCtx/AuthProvider
export function useAuth(): Ctx {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
