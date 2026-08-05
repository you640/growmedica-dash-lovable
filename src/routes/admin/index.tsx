import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import { Package, ShoppingCart, Sparkles, Settings } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GrowMedica Admin" },
      {
        name: "description",
        content: "Prehľad WordPress integrácie, webhookov a modulov GrowMedica Admin.",
      },
      { property: "og:title", content: "Dashboard — GrowMedica Admin" },
      { property: "og:description", content: "Prehľad WordPress integrácie a modulov." },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  return (
    <div>
      <SectionHeading
        title="Vitajte v GrowMedica Admin"
        subtitle="Headless command center pre WordPress + Lovable Cloud. Fáza 1 — autentifikácia, integrácie a webhook log sú aktívne."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Produkty</div>
          <div className="text-3xl font-semibold mt-2">—</div>
          <div className="text-xs text-gm-text-muted mt-1">Dáta naživo budú vo Fáze 2.</div>
        </GlassPanel>
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Objednávky dnes</div>
          <div className="text-3xl font-semibold mt-2">—</div>
          <div className="text-xs text-gm-text-muted mt-1">Dáta naživo budú vo Fáze 2.</div>
        </GlassPanel>
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Zákazníci</div>
          <div className="text-3xl font-semibold mt-2">—</div>
          <div className="text-xs text-gm-text-muted mt-1">Dáta naživo budú vo Fáze 2.</div>
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
