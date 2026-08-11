import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/AdminShell";
import { runDiagnostics } from "@/lib/diagnostics.functions";

export const Route = createFileRoute("/admin/diagnostika")({
  head: () => ({
    meta: [
      { title: "Diagnostika — GrowMedica Admin" },
      {
        name: "description",
        content: "Server-side smoke test: env premenné, health, overview, produkty, objednávky.",
      },
      { property: "og:title", content: "Diagnostika — GrowMedica Admin" },
      { property: "og:description", content: "Kompletný server-to-server smoke test integrácií." },
    ],
  }),
  component: DiagnosticsPage,
});

type Report = Awaited<ReturnType<typeof runDiagnostics>>;

function DiagnosticsPage() {
  const run = useServerFn(runDiagnostics);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRun() {
    setLoading(true);
    try {
      const r = await run({ data: undefined });
      setReport(r);
      toast[r.ok ? "success" : "error"](r.summary);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Diagnostika"
        subtitle="Server-to-server smoke test: env premenné, health, overview, produkty, objednávky, unauth."
      />

      <button
        onClick={() => void onRun()}
        disabled={loading}
        className="px-4 py-2 rounded-gm-lg bg-[var(--gm-primary)]/10 border border-[var(--gm-primary)]/20 text-gm-text font-medium disabled:opacity-50"
      >
        {loading ? "Prebieha test…" : "Spustiť smoke test"}
      </button>

      {report && (
        <div className="space-y-6">
          <p className="text-sm text-gm-text-muted">
            {report.ok ? "✅" : "⚠️"} {report.summary} · {new Date(report.finishedAt).toLocaleString("sk-SK")}
          </p>

          <section className="space-y-2">
            <h3 className="font-semibold text-gm-text">Env premenné</h3>
            <ul className="text-sm space-y-1">
              {report.env.map((e) => (
                <li key={e.key} className="text-gm-text-muted">
                  {e.present ? "✅" : "❌"} {e.key}
                  {e.present ? ` (dĺžka ${e.length})` : " — chýba"}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-gm-text">Testy</h3>
            <ul className="text-sm space-y-2">
              {report.checks.map((c) => (
                <li key={c.name} className="text-gm-text-muted">
                  <span className="text-gm-text">
                    {c.ok ? "✅" : "❌"} {c.name}
                  </span>{" "}
                  — {c.status ?? "n/a"} · {c.ms} ms
                  {c.detail && (
                    <div className="mt-1 font-mono text-xs break-all opacity-80">{c.detail}</div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
