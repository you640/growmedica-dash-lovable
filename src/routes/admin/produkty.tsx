import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Package } from "lucide-react";
import { ShopifyDataPage } from "@/components/admin/ShopifyDataPage";
import { listShopifyProducts, type ShopifyProduct } from "@/lib/shopify.functions";

export const Route = createFileRoute("/admin/produkty")({
  component: ProduktyPage,
});

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktívny",
  DRAFT: "Koncept",
  ARCHIVED: "Archivovaný",
};

function formatPrice(price: string | null, currency: string | null): string {
  if (!price) return "—";
  const amount = Number(price);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: currency ?? "EUR",
  }).format(amount);
}

function ProduktyPage() {
  const fetchFn = useServerFn(listShopifyProducts);

  return (
    <ShopifyDataPage<ShopifyProduct>
      title="Produkty"
      subtitle="Shopify produkty + AI SEO optimalizácia."
      icon={<Package className="w-5 h-5" />}
      fetchFn={fetchFn}
      emptyLabel="V Shopify zatiaľ nie sú žiadne produkty."
      columns={[
        { key: "title", label: "Názov" },
        { key: "status", label: "Status" },
        { key: "inventory", label: "Sklad" },
        { key: "price", label: "Cena" },
        { key: "updated", label: "Upravené" },
      ]}
      renderRow={(p) => (
        <tr key={p.id} className="border-t border-gm-border">
          <td className="px-4 py-3 font-medium text-gm-text">{p.title}</td>
          <td className="px-4 py-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                p.status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : p.status === "DRAFT"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {STATUS_LABEL[p.status] ?? p.status}
            </span>
          </td>
          <td className="px-4 py-3 text-gm-text-muted">{p.totalInventory}</td>
          <td className="px-4 py-3 text-gm-text-muted">{formatPrice(p.price, p.currency)}</td>
          <td className="px-4 py-3 text-gm-text-muted whitespace-nowrap">
            {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("sk-SK") : "—"}
          </td>
        </tr>
      )}
    />
  );
}
