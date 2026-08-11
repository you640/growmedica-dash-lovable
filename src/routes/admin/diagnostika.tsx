import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/AdminShell";
import { runDiagnostics } from "@/lib/diagnostics.functions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

function Hint({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted underline-offset-4 cursor-help">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

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
      const msg = (e as Error).message || "Neznáma chyba";
      toast.error(
        msg.toLowerCase().includes("forbidden")
          ? "Nemáš oprávnenie: tvoj e-mail nie je v ADMIN_EMAILS."
          : msg.toLowerCase().includes("unauthorized")
            ? "Prihlásenie vypršalo — prihlás sa znova a skús test opäť."
            : `Test zlyhal: ${msg}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <SectionHeading
          title="Diagnostika"
          subtitle="Server-to-server smoke test: env premenné, health, overview, produkty, objednávky, unauth."
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => void onRun()}
              disabled={loading}
              className="px-4 py-2 rounded-gm-lg bg-[var(--gm-primary)]/10 border border-[var(--gm-primary)]/20 text-gm-text font-medium disabled:opacity-50"
            >
              {loading ? "Prebieha test…" : "Spustiť smoke test"}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            {loading
              ? "Test práve beží — volania na storefront môžu trvať pár sekúnd."
              : "Spustí sa na serveri (nie v prehliadači). Vyžaduje prihlásenie admina uvedeného v ADMIN_EMAILS."}
          </TooltipContent>
        </Tooltip>

        {report && (
          <div className="space-y-6">
            <p className="text-sm text-gm-text-muted">
              {report.ok ? "✅" : "⚠️"} {report.summary} ·{" "}
              {new Date(report.finishedAt).toLocaleString("sk-SK")}
            </p>

            <section className="space-y-2">
              <h3 className="font-semibold text-gm-text">Env premenné</h3>
              <ul className="text-sm space-y-1">
                {report.env.map((e) => (
                  <li key={e.key} className="text-gm-text-muted">
                    {e.present ? "✅" : "❌"} {e.hint ? <Hint text={e.hint}>{e.key}</Hint> : e.key}
                    {e.present ? ` (dĺžka ${e.length})` : " — chýba"}
                    {e.hint && <div className="mt-1 text-xs text-gm-text-muted/80">→ {e.hint}</div>}
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
                      {c.ok ? "✅" : "❌"} {c.hint ? <Hint text={c.hint}>{c.name}</Hint> : c.name}
                    </span>{" "}
                    — {c.status ?? "n/a"} · {c.ms} ms
                    {c.detail && (
                      <div className="mt-1 font-mono text-xs break-all opacity-80">{c.detail}</div>
                    )}
                    {c.hint && (
                      <div className="mt-1 text-xs text-[var(--gm-primary)]/90">
                        Návrh riešenia: {c.hint}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {report.remediation.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-semibold text-gm-text">Ako to opraviť</h3>
                <ol className="text-sm space-y-2 list-decimal pl-5">
                  {report.remediation.map((r, i) => (
                    <li key={i} className="text-gm-text-muted">
                      {r}
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-gm-text-muted/70">
                  Report nikdy nezobrazuje hodnoty secretov — iba či existujú a ich dĺžku.
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
