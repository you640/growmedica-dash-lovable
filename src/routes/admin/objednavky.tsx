import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SectionHeading } from "@/components/admin/AdminShell";
import { DataTable } from "@/components/admin/DataTable";
import { listSyncedOrders } from "@/lib/wp-data.functions";

export const Route = createFileRoute("/admin/objednavky")({
  head: () => ({
    meta: [
      { title: "Objednávky — GrowMedica Admin" },
      {
        name: "description",
        content: "Live feed objednávok z WooCommerce s fulfilment akciami.",
      },
      { property: "og:title", content: "Objednávky — GrowMedica Admin" },
      { property: "og:description", content: "Objednávky z WooCommerce v reálnom čase." },
    ],
  }),
  component: OrdersPage,
});

type Row = {
  id: string;
  wp_id: number;
  number: string | null;
  status: string | null;
  currency: string | null;
  total: number | null;
  customer_email: string | null;
  customer_name: string | null;
  item_count: number | null;
  wp_created_at: string | null;
};

const STATUSES = ["", "pending", "processing", "on-hold", "completed", "cancelled", "refunded"];

function OrdersPage() {
  const fn = useServerFn(listSyncedOrders);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function load(s: string) {
    setLoading(true);
    try {
      const r = await fn({ data: { limit: 50, status: s || undefined } });
      setRows(r.rows as Row[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <SectionHeading
        title="Objednávky"
        subtitle="WooCommerce objednávky prijaté cez webhook relay."
      />
      <div className="mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-full border border-gm-border bg-white px-4 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "Všetky stavy"}
            </option>
          ))}
        </select>
      </div>
      <DataTable<Row>
        loading={loading}
        rows={rows}
        empty={
          <>
            Zatiaľ žiadne objednávky. Nastavte webhook relay v{" "}
            <Link to="/admin/nastavenia" className="text-gm-primary hover:underline">
              Nastaveniach
            </Link>
            .
          </>
        }
        columns={[
          { key: "number", label: "Číslo", render: (r) => `#${r.number ?? r.wp_id}` },
          {
            key: "date",
            label: "Dátum",
            render: (r) =>
              r.wp_created_at ? new Date(r.wp_created_at).toLocaleString("sk-SK") : "—",
          },
          {
            key: "customer",
            label: "Zákazník",
            render: (r) => r.customer_name || r.customer_email || "—",
          },
          { key: "status", label: "Stav", render: (r) => r.status ?? "—" },
          { key: "items", label: "Položky", render: (r) => r.item_count ?? "—" },
          {
            key: "total",
            label: "Suma",
            render: (r) => (r.total === null ? "—" : `${r.total} ${r.currency ?? ""}`.trim()),
          },
        ]}
      />
    </div>
  );
}
