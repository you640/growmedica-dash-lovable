import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import { dashboardOverview } from "@/lib/dashboard-bff.functions";
import { Package, ShoppingCart, Sparkles, Settings, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrowMedica Admin" },
      {
        name: "description",
        content: "Prehľad WooCommerce katalógu a modulov GrowMedica Admin cez storefront BFF.",
      },
      { property: "og:title", content: "Dashboard — GrowMedica Admin" },
      { property: "og:description", content: "Prehľad WooCommerce katalógu a modulov." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const overviewFn = useServerFn(dashboardOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        const o = await overviewFn();
        if (cancelled) return;
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

  return (
    <div>
      <SectionHeading
        title="Vitajte v GrowMedica Admin"
        subtitle="Headless command center — KPI z storefront BFF (Woo). Auth OAuth + ADMIN_EMAILS; commerce cez /api/dashboard/*."
      />

      {error && (
        <GlassPanel className="p-4 mb-4 border-amber-200 bg-amber-50 text-amber-900 text-sm">
          Overview nedostupné: {error}. Skontrolujte Storefront BFF v Nastaveniach.
        </GlassPanel>
      )}

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

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        <Quick to="/admin/produkty" icon={<Package className="w-4 h-4" />}>
          Produkty
        </Quick>
        <Quick to="/admin/produkty" icon={<Sparkles className="w-4 h-4" />}>
          Inventár
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
