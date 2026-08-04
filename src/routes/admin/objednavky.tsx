import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingCart } from "lucide-react";
import { ShopifyDataPage } from "@/components/admin/ShopifyDataPage";
import { listShopifyOrders, type ShopifyOrder } from "@/lib/shopify.functions";

export const Route = createFileRoute("/admin/objednavky")({
  component: ObjednavkyPage,
});

function formatMoney(amount: string | null, currency: string | null): string {
  if (!amount) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: currency ?? "EUR" }).format(
    n,
  );
}

function statusClass(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (s === "paid" || s === "fulfilled") return "bg-green-100 text-green-700";
  if (s === "pending" || s === "partial") return "bg-amber-100 text-amber-700";
  if (s === "refunded" || s === "voided" || s === "cancelled") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function ObjednavkyPage() {
  const fetchFn = useServerFn(listShopifyOrders);

  return (
    <ShopifyDataPage<ShopifyOrder>
      title="Objednávky"
      subtitle="Live feed objednávok zo Shopify s fulfilment akciami."
      icon={<ShoppingCart className="w-5 h-5" />}
      fetchFn={fetchFn}
      emptyLabel="V Shopify zatiaľ nie sú žiadne objednávky."
      columns={[
        { key: "name", label: "Objednávka" },
        { key: "customer", label: "Zákazník" },
        { key: "total", label: "Suma" },
        { key: "payment", label: "Platba" },
        { key: "fulfillment", label: "Fulfilment" },
        { key: "created", label: "Dátum" },
      ]}
      renderRow={(o) => (
        <tr key={o.id} className="border-t border-gm-border">
          <td className="px-4 py-3 font-medium text-gm-text">{o.name}</td>
          <td className="px-4 py-3 text-gm-text-muted">{o.customer ?? "—"}</td>
          <td className="px-4 py-3 text-gm-text-muted">{formatMoney(o.total, o.currency)}</td>
          <td className="px-4 py-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(o.financialStatus)}`}
            >
              {o.financialStatus ?? "—"}
            </span>
          </td>
          <td className="px-4 py-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(o.fulfillmentStatus)}`}
            >
              {o.fulfillmentStatus ?? "—"}
            </span>
          </td>
          <td className="px-4 py-3 text-gm-text-muted whitespace-nowrap">
            {o.createdAt ? new Date(o.createdAt).toLocaleString("sk-SK") : "—"}
          </td>
        </tr>
      )}
    />
  );
}
