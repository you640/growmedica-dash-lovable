import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/AdminShell";
import { DataTable } from "@/components/admin/DataTable";
import { listSyncedCustomers } from "@/lib/wp-data.functions";

export const Route = createFileRoute("/admin/zakaznici")({
  head: () => ({
    meta: [
      { title: "Zákazníci — GrowMedica Admin" },
      { name: "description", content: "CRM pohľad na zákazníkov z WooCommerce a WordPressu." },
      { property: "og:title", content: "Zákazníci — GrowMedica Admin" },
      { property: "og:description", content: "CRM pohľad na zákazníkov z WooCommerce." },
    ],
  }),
  component: CustomersPage,
});

type Row = {
  id: string;
  wp_id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  orders_count: number | null;
  total_spent: number | null;
  wp_created_at: string | null;
};

function CustomersPage() {
  const fn = useServerFn(listSyncedCustomers);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load(q?: string) {
    setLoading(true);
    try {
      const r = await fn({ data: { limit: 50, search: q || undefined } });
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
        title="Zákazníci"
        subtitle="Zákazníci z WooCommerce synchronizovaní cez webhook relay."
      />
      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          placeholder="Hľadať podľa e-mailu…"
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
            Zatiaľ žiadni zákazníci. Nastavte webhook relay v{" "}
            <Link to="/admin/nastavenia" className="text-gm-primary hover:underline">
              Nastaveniach
            </Link>
            .
          </>
        }
        columns={[
          {
            key: "name",
            label: "Meno",
            render: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—",
          },
          { key: "email", label: "E-mail", render: (r) => r.email ?? "—" },
          { key: "orders", label: "Objednávky", render: (r) => r.orders_count ?? 0 },
          {
            key: "spent",
            label: "Útraty",
            render: (r) => (r.total_spent === null ? "—" : `${r.total_spent}`),
          },
          {
            key: "created",
            label: "Registrácia",
            render: (r) =>
              r.wp_created_at ? new Date(r.wp_created_at).toLocaleDateString("sk-SK") : "—",
          },
        ]}
      />
    </div>
  );
}
