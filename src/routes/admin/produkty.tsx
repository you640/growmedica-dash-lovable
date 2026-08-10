import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/AdminShell";
import { DataTable } from "@/components/admin/DataTable";
import { listSyncedContent } from "@/lib/wp-data.functions";

export const Route = createFileRoute("/admin/produkty")({
  head: () => ({
    meta: [
      { title: "Produkty — GrowMedica Admin" },
      {
        name: "description",
        content: "Produkty z WooCommerce (WordPress) a AI SEO optimalizácia cez Mistral.",
      },
      { property: "og:title", content: "Produkty — GrowMedica Admin" },
      { property: "og:description", content: "Produkty z WooCommerce a AI SEO optimalizácia." },
    ],
  }),
  component: ProductsPage,
});

type Row = {
  id: string;
  wp_id: number;
  title: string | null;
  slug: string | null;
  status: string | null;
  link: string | null;
  price: number | null;
  stock_status: string | null;
  stock_quantity: number | null;
  wp_modified_at: string | null;
};

function ProductsPage() {
  const fn = useServerFn(listSyncedContent);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load(q?: string) {
    setLoading(true);
    try {
      const r = await fn({ data: { contentType: "product", limit: 50, search: q || undefined } });
      setRows(r.rows as Row[]);
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

  return (
    <div>
      <SectionHeading
        title="Produkty"
        subtitle="WooCommerce produkty synchronizované cez webhook relay."
      />
      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          placeholder="Hľadať podľa názvu…"
          className="rounded-full border border-gm-border bg-white px-4 py-2 text-sm w-full max-w-sm"
        />
        <button
          onClick={() => load(search)}
          className="rounded-full bg-gm-primary text-white px-5 py-2 text-sm hover:opacity-90"
        >
          Hľadať
        </button>
      </div>
      <DataTable<Row>
        loading={loading}
        rows={rows}
        empty={
          <>
            Zatiaľ žiadne produkty. Nastavte webhook relay v{" "}
            <Link to="/admin/nastavenia" className="text-gm-primary hover:underline">
              Nastaveniach
            </Link>
            .
          </>
        }
        columns={[
          {
            key: "title",
            label: "Produkt",
            render: (r) =>
              r.link ? (
                <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline">
                  {r.title ?? `#${r.wp_id}`}
                </a>
              ) : (
                (r.title ?? `#${r.wp_id}`)
              ),
          },
          { key: "status", label: "Stav", render: (r) => r.status ?? "—" },
          {
            key: "price",
            label: "Cena",
            render: (r) => (r.price === null ? "—" : `${r.price} Kč`),
          },
          {
            key: "stock",
            label: "Sklad",
            render: (r) =>
              `${r.stock_status ?? "—"}${r.stock_quantity !== null ? ` (${r.stock_quantity})` : ""}`,
          },
          {
            key: "modified",
            label: "Upravené",
            render: (r) =>
              r.wp_modified_at ? new Date(r.wp_modified_at).toLocaleString("sk-SK") : "—",
          },
        ]}
      />
    </div>
  );
}
