import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import { getStoreOverview, type StoreOverview } from "@/lib/wp-data.functions";

export const Route = createFileRoute("/admin/analytika")({
  head: () => ({
    meta: [
      { title: "Analytika — GrowMedica Admin" },
      {
        name: "description",
        content: "Živé KPI obchodu GrowMedica: katalóg, objednávky, tržby a stav integrácií.",
      },
      { property: "og:title", content: "Analytika — GrowMedica Admin" },
      { property: "og:description", content: "Živé KPI obchodu a stav integrácií." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fn = useServerFn(getStoreOverview);
  const [data, setData] = useState<StoreOverview | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await fn());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = data?.mirror;

  return (
    <div>
      <SectionHeading
        title="Analytika"
        subtitle="Živé dáta zo storefront API a zo synchronizovaných objednávok."
      />

      <div className="mb-4">
        <button
          onClick={load}
          disabled={loading}
          className="rounded-full border border-gm-border bg-white px-4 py-2 text-sm hover:bg-gm-bg-soft disabled:opacity-50 inline-flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Obnoviť
        </button>
      </div>

      {data?.error && (
        <GlassPanel className="p-4 mb-4 text-sm text-red-700 border-red-200 bg-red-50">
          {data.error}{" "}
          <Link to="/admin/diagnostika" className="underline">
            Spustiť diagnostiku
          </Link>
        </GlassPanel>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Produkty v katalógu" value={data?.store?.productCount ?? m?.products ?? null} />
        <Kpi label="Nízky sklad" value={data?.store?.lowStock ?? null} />
        <Kpi label="Objednávky (synced)" value={m?.orders ?? null} />
        <Kpi
          label="Tržby (synced)"
          value={m ? `${m.revenue.toLocaleString("sk-SK")} ${m.currency}` : null}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <GlassPanel className="p-6">
          <div className="text-sm font-medium mb-3">Objednávky podľa stavu</div>
          {!m || m.byStatus.length === 0 ? (
            <p className="text-sm text-gm-text-muted">
              Zatiaľ žiadne synchronizované objednávky — spustite backfill v{" "}
              <Link to="/admin/nastavenia" className="text-gm-primary hover:underline">
                Nastaveniach
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {m.byStatus.map((s) => (
                <li key={s.status} className="flex items-center justify-between">
                  <span className="capitalize">{s.status}</span>
                  <span className="font-medium">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-6">
          <div className="text-sm font-medium mb-3">Stav integrácií</div>
          <ul className="space-y-2 text-sm text-gm-text-muted">
            <li>CMS: {data?.health?.cmsProvider ?? "—"}</li>
            <li>Katalóg: {data?.health?.catalog ?? "—"}</li>
            <li>Mistral: {data?.health?.mistral ?? "—"}</li>
            <li>Zákazníci v databáze: {m?.customers ?? 0}</li>
          </ul>
        </GlassPanel>
      </div>

      <GlassPanel className="mt-6 p-6">
        <div className="text-sm font-medium mb-3">Posledné objednávky</div>
        {!m || m.recent.length === 0 ? (
          <p className="text-sm text-gm-text-muted">Žiadne dáta.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-gm-text-muted">
                <tr>
                  <th className="text-left py-2">Číslo</th>
                  <th className="text-left py-2">Zákazník</th>
                  <th className="text-left py-2">Stav</th>
                  <th className="text-left py-2">Suma</th>
                  <th className="text-left py-2">Dátum</th>
                </tr>
              </thead>
              <tbody>
                {m.recent.map((o) => (
                  <tr key={o.id} className="border-t border-gm-border">
                    <td className="py-2">{o.number ?? "—"}</td>
                    <td className="py-2">{o.customer_name ?? "—"}</td>
                    <td className="py-2">{o.status ?? "—"}</td>
                    <td className="py-2">
                      {o.total === null ? "—" : `${o.total} ${o.currency ?? ""}`}
                    </td>
                    <td className="py-2">
                      {o.wp_created_at ? new Date(o.wp_created_at).toLocaleString("sk-SK") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string | null }) {
  return (
    <GlassPanel className="p-6">
      <div className="text-xs uppercase tracking-wider text-gm-text-muted">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value ?? "—"}</div>
    </GlassPanel>
  );
}
