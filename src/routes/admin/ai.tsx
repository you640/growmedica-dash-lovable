import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import {
  dashboardAgent,
  dashboardAudit,
  dashboardExportDownload,
  type AgentMode,
  type DashboardAuditEntry,
  type AgentAction,
} from "@/lib/dashboard-bff.functions";
import { Loader2, Send, RefreshCw, Download, Sparkles } from "lucide-react";

const CONVERSATION_KEY = "gm_lovable_agent_conversation_id";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({
    meta: [
      { title: "Agentic AI — GrowMedica Admin" },
      {
        name: "description",
        content: "Mistral agent cez storefront BFF — assist/plan/monitor, audit a CSV export.",
      },
      { property: "og:title", content: "Agentic AI — GrowMedica Admin" },
      { property: "og:description", content: "AI command bar cez storefront BFF." },
    ],
  }),
  component: AgentPage,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: AgentAction[];
};

const QUICK = [
  { label: "Produkty", command: "Zobraz produkty" },
  { label: "Export CSV", command: "Export CSV katalógu" },
  { label: "Stav integrácie", command: "Stav integrácie" },
  { label: "Súhrn katalógu", command: "Súhrn katalógu" },
];

function AgentPage() {
  const agentFn = useServerFn(dashboardAgent);
  const auditFn = useServerFn(dashboardAudit);
  const exportFn = useServerFn(dashboardExportDownload);

  const [mode, setMode] = useState<AgentMode>("assist");
  const [command, setCommand] = useState("");
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<DashboardAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditKey, setAuditKey] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CONVERSATION_KEY) ?? "";
      if (saved) setConversationId(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const r = await auditFn({ data: { limit: 20, offset: 0 } });
      setAudit(r.entries ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAuditLoading(false);
    }
  }, [auditFn]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit, auditKey]);

  async function runCommand(value: string) {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setLoading(true);
    try {
      const r = await agentFn({
        data: {
          command: trimmed,
          conversation_id: conversationId || undefined,
          mode,
        },
      });
      if (r.conversation_id && r.conversation_id !== conversationId) {
        setConversationId(r.conversation_id);
        try {
          window.localStorage.setItem(CONVERSATION_KEY, r.conversation_id);
        } catch {
          /* ignore */
        }
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: r.reply, actions: r.actions },
      ]);
      setAuditKey((k) => k + 1);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      setMessages((m) => [...m, { role: "assistant", content: `❌ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = command;
    setCommand("");
    await runCommand(value);
  }

  async function downloadExport(exportId: string) {
    setExporting(exportId);
    try {
      const r = await exportFn({ data: { exportId } });
      const blob = new Blob([r.content], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Stiahnuté: ${r.filename}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  const modeHint =
    mode === "plan"
      ? "Plan: návrhy a dry-run, bez live zápisov."
      : mode === "monitor"
        ? "Monitor: len read tools (stav, alerty, reporty)."
        : "Assist: plný agent; write tools len s confirm + DASHBOARD_ALLOW_LIVE_WRITES.";

  return (
    <div>
      <SectionHeading
        title="Agentic AI"
        subtitle="Mistral agent cez storefront POST /api/dashboard/agent. Secret ostáva na Lovable serveri."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <GlassPanel className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["assist", "plan", "monitor"] as AgentMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize border transition ${
                    mode === m
                      ? "bg-gm-primary text-white border-gm-primary"
                      : "bg-white border-gm-border text-gm-text-muted hover:text-gm-text"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-xs text-gm-text-muted">{modeHint}</p>

            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button
                  key={q.command}
                  type="button"
                  disabled={loading}
                  onClick={() => void runCommand(q.command)}
                  className="rounded-full border border-gm-border bg-white px-3 py-1.5 text-xs hover:bg-gm-bg-soft disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <form onSubmit={(e) => void onSubmit(e)} className="flex gap-2">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Príkaz pre agenta…"
                disabled={loading}
                className="flex-1 rounded-md border border-gm-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-gm-primary/30 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !command.trim()}
                className="rounded-full bg-gm-primary text-white px-4 py-2 text-sm inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Odoslať
              </button>
            </form>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </GlassPanel>

          <GlassPanel className="p-4 space-y-4 min-h-[280px]">
            {messages.length === 0 ? (
              <div className="text-sm text-gm-text-muted flex items-center gap-2 py-8 justify-center">
                <Sparkles className="w-4 h-4" />
                Zadajte príkaz alebo použite quick action.
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-md px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-[var(--gm-primary)]/10 ml-8"
                      : "bg-gm-bg-soft mr-4"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-gm-text-muted mb-1">
                    {msg.role === "user" ? "Vy" : "Agent"}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  {msg.actions && msg.actions.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs">
                      {msg.actions.map((a, j) => {
                        const exportId =
                          typeof a.result?.export_id === "string"
                            ? a.result.export_id
                            : null;
                        return (
                          <li
                            key={j}
                            className="flex flex-wrap items-center gap-2 border-t border-gm-border/60 pt-1"
                          >
                            <span className="font-mono">{a.tool}</span>
                            <span
                              className={
                                a.status === "ok" ? "text-green-700" : "text-amber-700"
                              }
                            >
                              {a.status}
                            </span>
                            {exportId && (
                              <button
                                type="button"
                                disabled={exporting === exportId}
                                onClick={() => void downloadExport(exportId)}
                                className="inline-flex items-center gap-1 rounded-full border border-gm-border bg-white px-2 py-0.5 hover:bg-white disabled:opacity-50"
                              >
                                {exporting === exportId ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                Stiahnuť CSV
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))
            )}
          </GlassPanel>
        </div>

        <GlassPanel className="p-0 overflow-hidden h-fit">
          <div className="flex items-center justify-between border-b border-gm-border px-4 py-2">
            <h2 className="text-sm font-semibold">Audit log</h2>
            <button
              type="button"
              onClick={() => void loadAudit()}
              className="inline-flex items-center gap-1 text-xs text-gm-text-muted hover:text-gm-text"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Obnoviť
            </button>
          </div>
          {auditLoading ? (
            <p className="px-4 py-3 text-xs text-gm-text-muted flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Načítavam…
            </p>
          ) : audit.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gm-text-muted">Zatiaľ prázdne.</p>
          ) : (
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-xs">
                <thead className="bg-gm-bg-soft text-gm-text-muted sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Čas</th>
                    <th className="text-left px-3 py-2">Tool</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e) => (
                    <tr key={e.id} className="border-t border-gm-border">
                      <td className="px-3 py-2 whitespace-nowrap text-gm-text-muted">
                        {e.timestamp
                          ? new Date(e.timestamp).toLocaleString("sk-SK")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">{e.tool}</td>
                      <td className="px-3 py-2">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
