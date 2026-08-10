import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import {
  dashboardOverview,
  dashboardHealth,
  type DashboardHealth,
  type DashboardOverview,
} from "@/lib/dashboard-bff.functions";
import { Package, ShoppingCart, Sparkles, Settings, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrowMedica Admin" },
      {
        name: "description",
        content: "Prehľad WooCommerce katalógu a BFF health cez storefront proxy.",
      },
      { property: "og:title", content: "Dashboard — GrowMedica Admin" },
      { property: "og:description", content: "Prehľad WooCommerce katalógu a modulov." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const overviewFn = useServerFn(dashboardOverview);
  const healthFn = useServerFn(dashboardHealth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<DashboardHealth | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [kpi, setKpi] = useState<{
    products: number | null;
    collections: number | null;
    unavailable: number | null;
    ordersToday: number | null;
  }>({ products: null, collections: null, unavailable: null, ordersToday: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [o, h] = await Promise.all([overviewFn(), healthFn()]);
        if (cancelled) return;
        setOverview(o);
        setHealth(h);
        const today = new Date().toISOString().slice(0, 10);
        const ordersToday = (o.recent_orders ?? []).filter((ord) =>
          String(ord.createdAt ?? "").startsWith(today),
        ).length;
        setKpi({
          products: o.product_count,
          collections: o.collection_count,
          unavailable: o.unavailable_count,
          ordersToday,
        });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recentOrders = overview?.recent_orders ?? [];
  const recentAudit = Array.isArray(overview?.recent_audit) ? overview!.recent_audit : [];

  return (
    <div>
      <SectionHeading
        title="Vitajte v GrowMedica Admin"
        subtitle="KPI a živý BFF stav (Woo/Mistral/writes). Auth OAuth + ADMIN_EMAILS."
      />

      {error && (
        <GlassPanel className="p-4 mb-4 border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Overview/health nedostupné: {error}. Skontrolujte Storefront BFF v Nastaveniach.
        </GlassPanel>
      )}

      <GlassPanel className="p-4 mb-4">
        <div className="text-xs uppercase tracking-wider text-gm-text-muted mb-2">
          Storefront BFF status
        </div>
        {loading && !health ? (
          <div className="flex items-center gap-2 text-sm text-gm-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítavam…
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <StatusPill
              label="catalog"
              value={health?.catalog ?? "—"}
              ok={health?.ok && health.catalog != null}
            />
            <StatusPill
              label="mistral"
              value={health?.mistral ?? "—"}
              ok={health?.mistral === "configured" || health?.mistral === "mock"}
            />
            <StatusPill
              label="write_mode"
              value={health?.write_mode ?? "—"}
              ok={!!health?.write_mode}
            />
            <StatusPill
              label="cms"
              value={health?.cms_provider ?? "—"}
              ok={!!health?.cms_provider}
            />
            <StatusPill
              label="redis"
              value={health?.redis ? "yes" : "no"}
              ok={!!health?.redis}
            />
            <StatusPill
              label="SF"
              value={health?.merchants?.superfaktura ? "on" : "off"}
              ok={health?.merchants?.superfaktura === true}
            />
            <StatusPill
              label="Stripe"
              value={health?.merchants?.stripe ? "on" : "off"}
              ok={health?.merchants?.stripe === true}
            />
            <StatusPill
              label="Packeta"
              value={health?.merchants?.packeta ? "on" : "off"}
              ok={health?.merchants?.packeta === true}
            />
            <StatusPill
              label="DPD"
              value={health?.merchants?.dpd ? "on" : "off"}
              ok={health?.merchants?.dpd === true}
            />
            <StatusPill
              label="GoPay"
              value={health?.merchants?.gopay ? "on" : "off"}
              ok={health?.merchants?.gopay === true}
            />
          </div>
        )}
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Produkty"
          value={kpi.products}
          loading={loading}
          hint={
            kpi.unavailable != null
              ? `Nedostupné: ${kpi.unavailable} · kolekcie: ${kpi.collections ?? "—"}`
              : "Live z GET /api/dashboard/overview"
          }
        />
        <KpiCard
          label="Objednávky dnes"
          value={kpi.ordersToday}
          loading={loading}
          hint="Z recent_orders (dnešný dátum)"
        />
        <KpiCard
          label="Kolekcie"
          value={kpi.collections}
          loading={loading}
          hint="Woo kategórie / collections"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold mb-2">Posledné objednávky</h3>
          {loading ? (
            <p className="text-xs text-gm-text-muted">Načítavam…</p>
          ) : recentOrders.length === 0 ? (
            <p className="text-xs text-gm-text-muted">Žiadne (mock často prázdny).</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {recentOrders.slice(0, 5).map((o, i) => (
                <li
                  key={`${o.name}-${i}`}
                  className="flex justify-between gap-2 border-t border-gm-border/50 pt-1"
                >
                  <span>
                    {o.name} · {o.financialStatus}
                  </span>
                  <span className="tabular-nums text-gm-text-muted">
                    {o.total} {o.currency}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold mb-2">Posledný audit</h3>
          {loading ? (
            <p className="text-xs text-gm-text-muted">Načítavam…</p>
          ) : recentAudit.length === 0 ? (
            <p className="text-xs text-gm-text-muted">Zatiaľ prázdne.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {recentAudit.slice(0, 5).map((raw, i) => {
                const e = raw as {
                  id?: string;
                  tool?: string;
                  status?: string;
                  timestamp?: string;
                };
                return (
                  <li
                    key={e.id ?? i}
                    className="flex justify-between gap-2 border-t border-gm-border/50 pt-1"
                  >
                    <span className="font-mono">{e.tool ?? "—"}</span>
                    <span className="text-gm-text-muted">
                      {e.status}
                      {e.timestamp
                        ? ` · ${new Date(e.timestamp).toLocaleString("sk-SK")}`
                        : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassPanel>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        <Quick to="/admin/produkty" icon={<Package className="w-4 h-4" />}>
          Produkty
        </Quick>
        <Quick to="/admin/ai" icon={<Sparkles className="w-4 h-4" />}>
          Agentic AI
        </Quick>
        <Quick to="/admin/objednavky" icon={<ShoppingCart className="w-4 h-4" />}>
          Objednávky
        </Quick>
        <Quick to="/admin/nastavenia" icon={<Settings className="w-4 h-4" />}>
          Integrácie
        </Quick>
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        ok
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-gm-border bg-white text-gm-text-muted"
      }`}
    >
      <span className="uppercase tracking-wider opacity-70">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function KpiCard({
  label,
  value,
  loading,
  hint,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  hint: string;
}) {
  return (
    <GlassPanel className="p-6">
      <div className="text-xs uppercase tracking-wider text-gm-text-muted">{label}</div>
      <div className="text-3xl font-semibold mt-2 flex items-center gap-2">
        {loading ? <Loader2 className="w-6 h-6 animate-spin text-gm-text-muted" /> : (value ?? "—")}
      </div>
      <div className="text-xs text-gm-text-muted mt-1">{hint}</div>
    </GlassPanel>
  );
}

function Quick({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-gm-lg border border-gm-border bg-white/60 backdrop-blur-md px-4 py-3 text-sm hover:bg-white transition-colors"
    >
      <span className="text-gm-primary">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}
