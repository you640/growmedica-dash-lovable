import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import {
  dashboardOrders,
  dashboardOrderAnomalies,
  dashboardInventoryAlerts,
  type DashboardOrderRow,
} from "@/lib/dashboard-bff.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, ShoppingCart, AlertTriangle, Package } from "lucide-react";

export const Route = createFileRoute("/admin/objednavky")({
  head: () => ({
    meta: [
      { title: "Objednávky — GrowMedica Admin" },
      {
        name: "description",
        content: "WooCommerce objednávky, anomálie a skladové alerty cez storefront BFF.",
      },
      { property: "og:title", content: "Objednávky — GrowMedica Admin" },
      { property: "og:description", content: "Objednávky a alerty z WooCommerce." },
    ],
  }),
  component: OrdersPage,
});

type StaleOrder = {
  id?: string;
  status?: string;
  hours_open?: number;
  total?: string;
};

type InvAlert = {
  handle?: string;
  title?: string;
  stock_status?: string;
  stock_quantity?: number | null;
  severity?: string;
};

function OrdersPage() {
  return (
    <div>
      <SectionHeading
        title="Objednávky"
        subtitle="Live Woo feed + agent tools order_anomalies / inventory_alerts (monitor mode)."
      />
      <Tabs defaultValue="zoznam">
        <TabsList className="mb-4 bg-gm-bg-soft">
          <TabsTrigger value="zoznam">Zoznam</TabsTrigger>
          <TabsTrigger value="anomalie">Anomálie</TabsTrigger>
          <TabsTrigger value="sklad">Sklad alerty</TabsTrigger>
        </TabsList>
        <TabsContent value="zoznam">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="anomalie">
          <AnomaliesTab />
        </TabsContent>
        <TabsContent value="sklad">
          <InventoryAlertsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrdersTab() {
  const listFn = useServerFn(dashboardOrders);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DashboardOrderRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listFn({ data: { limit: 30 } });
      setRows(r.orders);
      setNote(r.note ?? null);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <GlassPanel className="p-4 mb-4 flex flex-wrap gap-3 items-center justify-between text-sm">
        <div className="text-gm-text-muted flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          {note ?? "GET /api/dashboard/orders"}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-gm-border bg-white px-3 py-2 text-sm inline-flex items-center gap-2 hover:bg-gm-bg-soft"
        >
          <RefreshCw className="w-4 h-4" />
          Obnoviť
        </button>
      </GlassPanel>

      {error && (
        <GlassPanel className="p-4 mb-4 text-sm text-red-800 bg-red-50 border-red-200">
          {error}
        </GlassPanel>
      )}

      <GlassPanel className="overflow-hidden p-0">
        {loading ? (
          <div className="p-8 flex items-center gap-2 text-sm text-gm-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítavam objednávky…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-gm-text-muted">
            Žiadne objednávky (v mock režime je zoznam prázdny).
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gm-bg-soft text-gm-text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Objednávka</th>
                  <th className="text-left px-4 py-3">Zákazník</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Platba</th>
                  <th className="text-right px-4 py-3">Suma</th>
                  <th className="text-left px-4 py-3">Dátum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id} className="border-t border-gm-border">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3">
                      <div>{o.customerName}</div>
                      <div className="text-xs text-gm-text-muted">{o.customerEmail || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{o.financialStatus}</div>
                      <div className="text-gm-text-muted">{o.fulfillmentStatus}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{o.paymentMethod || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {o.total} {o.currency}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString("sk-SK") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </>
  );
}

function AnomaliesTab() {
  const fn = useServerFn(dashboardOrderAnomalies);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<StaleOrder[]>([]);
  const [failed, setFailed] = useState(0);
  const [checked, setChecked] = useState(0);
  const [hours, setHours] = useState(48);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fn();
      setStale((r.stale_orders as StaleOrder[]) ?? []);
      setFailed(r.failed_count);
      setChecked(r.checked);
      setHours(r.stale_threshold_hours);
      setNote(r.note);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <GlassPanel className="p-4 mb-4 flex flex-wrap gap-3 items-center justify-between text-sm">
        <div className="text-gm-text-muted flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {note ??
            `order_anomalies · checked ${checked} · failed ${failed} · stale>${hours}h`}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-gm-border bg-white px-3 py-2 text-sm inline-flex items-center gap-2 hover:bg-gm-bg-soft"
        >
          <RefreshCw className="w-4 h-4" />
          Obnoviť
        </button>
      </GlassPanel>
      {error && (
        <GlassPanel className="p-4 mb-4 text-sm text-red-800 bg-red-50 border-red-200">
          {error}
        </GlassPanel>
      )}
      <GlassPanel className="overflow-hidden p-0">
        {loading ? (
          <div className="p-8 flex items-center gap-2 text-sm text-gm-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Kontrolujem anomálie…
          </div>
        ) : stale.length === 0 ? (
          <div className="p-8 text-sm text-gm-text-muted">
            Žiadne zaseknuté objednávky
            {failed ? ` · failed payments: ${failed}` : ""}.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gm-bg-soft text-gm-text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">ID</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Hodiny otvorené</th>
                  <th className="text-right px-4 py-3">Suma</th>
                </tr>
              </thead>
              <tbody>
                {stale.map((o, i) => (
                  <tr key={o.id ?? i} className="border-t border-gm-border">
                    <td className="px-4 py-3 font-mono text-xs">{o.id ?? "—"}</td>
                    <td className="px-4 py-3">{o.status ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.hours_open ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{o.total ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </>
  );
}

function InventoryAlertsTab() {
  const fn = useServerFn(dashboardInventoryAlerts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<InvAlert[]>([]);
  const [checked, setChecked] = useState(0);
  const [threshold, setThreshold] = useState(5);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fn({ data: { threshold: 5 } });
      setAlerts((r.alerts as InvAlert[]) ?? []);
      setChecked(r.checked);
      setThreshold(r.threshold);
      setNote(r.note);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <GlassPanel className="p-4 mb-4 flex flex-wrap gap-3 items-center justify-between text-sm">
        <div className="text-gm-text-muted flex items-center gap-2">
          <Package className="w-4 h-4" />
          {note ?? `inventory_alerts · checked ${checked} · threshold ≤ ${threshold}`}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-gm-border bg-white px-3 py-2 text-sm inline-flex items-center gap-2 hover:bg-gm-bg-soft"
        >
          <RefreshCw className="w-4 h-4" />
          Obnoviť
        </button>
      </GlassPanel>
      {error && (
        <GlassPanel className="p-4 mb-4 text-sm text-red-800 bg-red-50 border-red-200">
          {error}
        </GlassPanel>
      )}
      <GlassPanel className="overflow-hidden p-0">
        {loading ? (
          <div className="p-8 flex items-center gap-2 text-sm text-gm-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Kontrolujem sklad…
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-sm text-gm-text-muted">Žiadne skladové alerty.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gm-bg-soft text-gm-text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Produkt</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Severity</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.handle} className="border-t border-gm-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.title ?? "—"}</div>
                      <div className="font-mono text-xs text-gm-text-muted">{a.handle}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{a.stock_status ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.stock_quantity ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={
                          a.severity === "critical" ? "text-red-700" : "text-amber-700"
                        }
                      >
                        {a.severity ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </>
  );
}
