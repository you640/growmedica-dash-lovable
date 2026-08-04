import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { ShopifyDataPage } from "@/components/admin/ShopifyDataPage";
import { listShopifyCustomers, type ShopifyCustomer } from "@/lib/shopify.functions";

export const Route = createFileRoute("/admin/zakaznici")({
  component: ZakaznikPage,
});

function formatMoney(amount: string | null, currency: string | null): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: currency ?? "EUR" }).format(
    n,
  );
}

function ZakaznikPage() {
  const fetchFn = useServerFn(listShopifyCustomers);

  return (
    <ShopifyDataPage<ShopifyCustomer>
      title="Zákazníci"
      subtitle="CRM pohľad na zákazníkov zo Shopify a marketing platformy."
      icon={<Users className="w-5 h-5" />}
      fetchFn={fetchFn}
      emptyLabel="V Shopify zatiaľ nie sú žiadni zákazníci."
      columns={[
        { key: "name", label: "Meno" },
        { key: "email", label: "E-mail" },
        { key: "orders", label: "Objednávky" },
        { key: "spent", label: "Celkovo minuté" },
        { key: "created", label: "Zákazník od" },
      ]}
      renderRow={(c) => (
        <tr key={c.id} className="border-t border-gm-border">
          <td className="px-4 py-3 font-medium text-gm-text">{c.name || "—"}</td>
          <td className="px-4 py-3 text-gm-text-muted">{c.email ?? "—"}</td>
          <td className="px-4 py-3 text-gm-text-muted">{c.ordersCount}</td>
          <td className="px-4 py-3 text-gm-text-muted">{formatMoney(c.totalSpent, c.currency)}</td>
          <td className="px-4 py-3 text-gm-text-muted whitespace-nowrap">
            {c.createdAt ? new Date(c.createdAt).toLocaleDateString("sk-SK") : "—"}
          </td>
        </tr>
      )}
    />
  );
}
