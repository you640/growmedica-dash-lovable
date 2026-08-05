import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/admin/AuthProvider";
import { Apple } from "lucide-react";

type Search = { next?: string };

export const Route = createFileRoute("/admin/prihlasenie")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, signInWithProvider } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/prihlasenie" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "google" | "apple">(null);

  useEffect(() => {
    if (!loading && user) {
      const next = search.next ? decodeURIComponent(search.next) : "/admin";
      navigate({ to: next });
    }
  }, [user, loading, search.next, navigate]);

  async function go(provider: "google" | "apple") {
    setErr(null);
    setBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] p-4">
      <div className="w-full max-w-md rounded-gm-lg border border-gm-border bg-white/70 backdrop-blur-md p-8 shadow-sm">
        <div className="text-2xl font-semibold tracking-tight">
          Grow<span className="text-gm-primary">Medica</span>{" "}
          <span className="text-gm-text-muted text-base">Admin</span>
        </div>
        <p className="text-sm text-gm-text-muted mt-2">
          Prihláste sa cez Google alebo Apple. Prístup je obmedzený na e-maily z whitelistu.
        </p>

        <div className="mt-6 space-y-3">
          <button
            disabled={busy !== null}
            onClick={() => go("google")}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full bg-white border border-gm-border px-5 py-3 text-sm font-medium text-gm-text hover:bg-gm-bg-soft disabled:opacity-50 transition shadow-sm"
          >
            <GoogleGlyph />
            {busy === "google" ? "Otvára sa Google…" : "Pokračovať s Google"}
          </button>
          <button
            disabled={busy !== null}
            onClick={() => go("apple")}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full bg-black text-white px-5 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
          >
            <Apple className="w-4 h-4" />
            {busy === "apple" ? "Otvára sa Apple…" : "Pokračovať s Apple"}
          </button>
        </div>
        {err && <div className="mt-4 text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
