import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./AuthProvider";
import { verifyAdminAccess } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";

type AccessState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "forbidden"; email: string }
  | { kind: "ok"; email: string };

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const verify = useServerFn(verifyAdminAccess);
  const [state, setState] = useState<AccessState>({ kind: "loading" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loading) return;
      if (!user) {
        setState({ kind: "anonymous" });
        return;
      }
      try {
        const res = await verify();
        if (!cancelled) setState({ kind: "ok", email: res.email });
      } catch (e) {
        const msg = (e as Error).message ?? "";
        if (!cancelled)
          setState(
            msg.includes("Forbidden")
              ? { kind: "forbidden", email: user.email ?? "" }
              : { kind: "anonymous" },
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, verify]);

  if (state.kind === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FDFBF7] text-gm-text-muted">
        <div className="text-sm">Overujeme prístup do administrácie…</div>
      </div>
    );
  }
  if (state.kind === "anonymous") {
    return <Navigate to="/admin/prihlasenie" search={{ next: pathname }} />;
  }
  if (state.kind === "forbidden") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#FDFBF7] gap-3">
        <div className="text-xl font-semibold">Prístup zamietnutý</div>
        <div className="text-sm text-gm-text-muted">
          Účet <code>{state.email}</code> nemá oprávnenie na vstup do administrácie.
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
