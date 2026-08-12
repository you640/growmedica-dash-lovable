import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import { getWpSyncStatus, type SyncStatus } from "@/lib/wp-data.functions";
import { Package, ShoppingCart, Users, Settings, Stethoscope, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrowMedica Admin" },
      {
        name: "description",
        content: "Prehľad WordPress a WooCommerce dát, webhookov a stavu integrácií GrowMedica.",
      },
      { property: "og:title", content: "Dashboard — GrowMedica Admin" },
      { property: "og:description", content: "Prehľad WordPress a WooCommerce dát." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const fn = useServerFn(getWpSyncStatus);
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    fn()
      .then(setStatus)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = status?.counts;

  return (
    <div>
      <SectionHeading
        title="Vitajte v GrowMedica Admin"
        subtitle="Headless command center pre WordPress + WooCommerce a Lovable Cloud."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Produkty" value={c?.product} to="/admin/produkty" />
        <Stat label="Objednávky" value={c?.order} to="/admin/objednavky" />
        <Stat label="Zákazníci" value={c?.customer} to="/admin/zakaznici" />
        <Stat label="Obsah (články + stránky)" value={c ? c.post + c.page : undefined} />
      </div>

      {status && (c?.product ?? 0) === 0 && (
        <GlassPanel className="mt-4 p-4 text-sm text-gm-text-muted">
          Databáza je zatiaľ prázdna — spustite backfill WooCommerce v{" "}
          <Link to="/admin/nastavenia" className="text-gm-primary hover:underline">
            Nastaveniach → WordPress
          </Link>
          .
        </GlassPanel>
      )}

      <div className="mt-8 grid gap-3 md:grid-cols-4">
        <Quick to="/admin/produkty" icon={<Package className="w-4 h-4" />}>
          Produkty
        </Quick>
        <Quick to="/admin/objednavky" icon={<ShoppingCart className="w-4 h-4" />}>
          Objednávky
        </Quick>
        <Quick to="/admin/zakaznici" icon={<Users className="w-4 h-4" />}>
          Zákazníci
        </Quick>
        <Quick to="/admin/analytika" icon={<BarChart3 className="w-4 h-4" />}>
          Analytika
        </Quick>
        <Quick to="/admin/nastavenia" icon={<Settings className="w-4 h-4" />}>
          Integrácie
        </Quick>
        <Quick to="/admin/diagnostika" icon={<Stethoscope className="w-4 h-4" />}>
          Diagnostika
        </Quick>
      </div>
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value?: number; to?: string }) {
  const body = (
    <GlassPanel className="p-6 h-full">
      <div className="text-xs uppercase tracking-wider text-gm-text-muted">{label}</div>
      <div className="text-3xl font-semibold mt-2">{value ?? "—"}</div>
      <div className="text-xs text-gm-text-muted mt-1">Synchronizované dáta z WordPressu.</div>
    </GlassPanel>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
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
