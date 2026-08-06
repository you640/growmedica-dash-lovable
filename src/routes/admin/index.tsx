import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import { getWooCommerceDashboardSummary } from "@/lib/woocommerce.functions";
import { Package, ShoppingCart, Sparkles, Settings } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function StatValue({ value, notConnected }: { value: number | null; notConnected: boolean }) {
  if (notConnected) return <span className="text-lg text-gm-text-muted">Nepripojené</span>;
  if (value === null) return <span>—</span>;
  return <>{new Intl.NumberFormat("sk-SK").format(value)}</>;
}

function AdminHome() {
  const fetchSummary = useServerFn(getWooCommerceDashboardSummary);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    productsCount: number | null;
    ordersTodayCount: number | null;
    customersCount: number | null;
    notConnected: boolean;
  }>({ productsCount: null, ordersTodayCount: null, customersCount: null, notConnected: false });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchSummary();
        setSummary({
          productsCount: r.productsCount,
          ordersTodayCount: r.ordersTodayCount,
          customersCount: r.customersCount,
          notConnected: !r.ok,
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = summary.notConnected
    ? "Pripojte e-shop v Nastaveniach."
    : loading
      ? "Načítavam…"
      : "Dáta naživo z Admin API.";

  return (
    <div>
      <SectionHeading
        title="Vitajte v GrowMedica Admin"
        subtitle="Headless command center pre e-commerce + Lovable Cloud (Produkcia · Live Status)."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Produkty</div>
          <div className="text-3xl font-semibold mt-2">
            <StatValue value={summary.productsCount} notConnected={summary.notConnected} />
          </div>
          <div className="text-xs text-gm-text-muted mt-1">{hint}</div>
        </GlassPanel>
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Objednávky dnes</div>
          <div className="text-3xl font-semibold mt-2">
            <StatValue value={summary.ordersTodayCount} notConnected={summary.notConnected} />
          </div>
          <div className="text-xs text-gm-text-muted mt-1">{hint}</div>
        </GlassPanel>
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Zákazníci</div>
          <div className="text-3xl font-semibold mt-2">
            <StatValue value={summary.customersCount} notConnected={summary.notConnected} />
          </div>
          <div className="text-xs text-gm-text-muted mt-1">{hint}</div>
        </GlassPanel>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        <Quick to="/admin/produkty" icon={<Package className="w-4 h-4" />}>
          Nový produkt
        </Quick>
        <Quick to="/admin/produkty" icon={<Sparkles className="w-4 h-4" />}>
          AI Optimalizácia
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
