import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import {
  dashboardProducts,
  dashboardProduct,
  dashboardInventory,
  dashboardInventoryUpdate,
  dashboardHealth,
  type DashboardProductRow,
  type DashboardInventoryRow,
} from "@/lib/dashboard-bff.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, Package, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/produkty")({
  head: () => ({
    meta: [
      { title: "Produkty — GrowMedica Admin" },
      {
        name: "description",
        content: "WooCommerce produkty a inventár cez storefront BFF.",
      },
      { property: "og:title", content: "Produkty — GrowMedica Admin" },
      { property: "og:description", content: "Produkty a inventár z WooCommerce." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  return (
    <div>
      <SectionHeading
        title="Produkty"
        subtitle="Live katalóg a inventár z storefront BFF (Woo). Zápis skladu len pri write_mode=live_writes_allowed."
      />
      <Tabs defaultValue="katalog">
        <TabsList className="mb-4 bg-gm-bg-soft">
          <TabsTrigger value="katalog">Katalóg</TabsTrigger>
          <TabsTrigger value="inventar">Inventár</TabsTrigger>
        </TabsList>
        <TabsContent value="katalog">
          <CatalogTab />
        </TabsContent>
        <TabsContent value="inventar">
          <InventoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CatalogTab() {
  const listFn = useServerFn(dashboardProducts);
  const detailFn = useServerFn(dashboardProduct);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DashboardProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detailHandle, setDetailHandle] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listFn({ data: { search: q || undefined, limit: 40 } });
      setRows(r.products);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [listFn, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detailHandle) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const r = await detailFn({ data: { handle: detailHandle } });
        if (!cancelled) setDetail(r.product);
      } catch (e) {
        if (!cancelled) {
          toast.error((e as Error).message);
          setDetailHandle(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailHandle, detailFn]);

  return (
    <>
      <GlassPanel className="p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setQ(search.trim());
          }}
          placeholder="Hľadať produkt…"
          className="flex-1 min-w-[200px] rounded-md border border-gm-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-gm-primary/30"
        />
        <button
          type="button"
          onClick={() => setQ(search.trim())}
          className="rounded-full bg-gm-primary text-white px-4 py-2 text-sm hover:opacity-90"
        >
          Hľadať
        </button>
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
            <Loader2 className="w-4 h-4 animate-spin" /> Načítavam produkty…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-gm-text-muted flex items-center gap-2">
            <Package className="w-4 h-4" /> Žiadne produkty.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gm-bg-soft text-gm-text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Názov</th>
                  <th className="text-left px-4 py-3">Handle</th>
                  <th className="text-right px-4 py-3">Cena</th>
                  <th className="text-left px-4 py-3">Stav</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.handle}
                    className="border-t border-gm-border hover:bg-white/80 cursor-pointer"
                    onClick={() => setDetailHandle(p.handle)}
                  >
                    <td className="px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gm-text-muted">{p.handle}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(p.price).toLocaleString("sk-SK", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {p.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={p.available ? "text-green-700 text-xs" : "text-red-700 text-xs"}
                      >
                        {p.available ? "Dostupné" : "Nedostupné"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      <Sheet open={!!detailHandle} onOpenChange={(o) => !o && setDetailHandle(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {(detail?.title as string | undefined) ?? detailHandle ?? "Produkt"}
            </SheetTitle>
            <SheetDescription className="font-mono text-xs">{detailHandle}</SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-gm-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Načítavam detail…
            </div>
          ) : detail ? (
            <div className="mt-6 space-y-3 text-sm">
              <DetailRow label="Vendor" value={String(detail.vendor ?? "—")} />
              <DetailRow label="Dostupné" value={detail.availableForSale ? "áno" : "nie"} />
              <DetailRow
                label="Cena od"
                value={
                  (
                    detail.priceRange as {
                      minVariantPrice?: { amount?: string; currencyCode?: string };
                    }
                  )?.minVariantPrice
                    ? `${(detail.priceRange as { minVariantPrice: { amount: string; currencyCode: string } }).minVariantPrice.amount} ${(detail.priceRange as { minVariantPrice: { amount: string; currencyCode: string } }).minVariantPrice.currencyCode}`
                    : "—"
                }
              />
              <div>
                <div className="text-xs uppercase tracking-wider text-gm-text-muted mb-1">
                  Popis
                </div>
                <p className="text-gm-text-muted whitespace-pre-wrap">
                  {String(detail.description ?? "").slice(0, 600) || "—"}
                </p>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function InventoryTab() {
  const invFn = useServerFn(dashboardInventory);
  const updateFn = useServerFn(dashboardInventoryUpdate);
  const healthFn = useServerFn(dashboardHealth);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DashboardInventoryRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeAllowed, setWriteAllowed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, health] = await Promise.all([
        invFn({ data: { limit: 50, threshold: 10_000 } }),
        healthFn(),
      ]);
      setRows(inv.items);
      setNote(inv.note ?? null);
      setWriteAllowed(health.write_mode === "live_writes_allowed");
      const next: Record<string, string> = {};
      for (const item of inv.items) {
        next[item.handle] =
          item.quantity === null || item.quantity === undefined ? "" : String(item.quantity);
      }
      setDrafts(next);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [invFn, healthFn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(handle: string) {
    const qty = Number(drafts[handle]);
    if (!Number.isFinite(qty) || qty < 0) {
      toast.error("Zadajte nezáporné číslo.");
      return;
    }
    setSaving(handle);
    try {
      await updateFn({ data: { handle, quantity: Math.floor(qty) } });
      toast.success(`Sklad ${handle} → ${Math.floor(qty)}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <GlassPanel className="p-4 mb-4 flex flex-wrap gap-3 items-center justify-between text-sm">
        <div className="text-gm-text-muted">
          Write:{" "}
          <span className={writeAllowed ? "text-green-700 font-medium" : "text-amber-700"}>
            {writeAllowed ? "live_writes_allowed" : "dry_run / vypnuté"}
          </span>
          {note ? ` · ${note}` : null}
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
            <Loader2 className="w-4 h-4 animate-spin" /> Načítavam inventár…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-sm text-gm-text-muted">
            Žiadne položky (mock režim môže vrátiť prázdny inventár).
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gm-bg-soft text-gm-text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3">Názov</th>
                  <th className="text-left px-4 py-3">SKU</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">Akcia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.handle} className="border-t border-gm-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.title}</div>
                      <div className="font-mono text-xs text-gm-text-muted">{item.handle}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{item.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">{item.stock_status}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min={0}
                        disabled={!writeAllowed}
                        value={drafts[item.handle] ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [item.handle]: e.target.value }))
                        }
                        className="w-24 rounded-md border border-gm-border bg-white px-2 py-1 text-right tabular-nums disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!writeAllowed || saving === item.handle}
                        onClick={() => void save(item.handle)}
                        className="rounded-full bg-gm-primary text-white px-3 py-1.5 text-xs hover:opacity-90 disabled:opacity-40"
                      >
                        {saving === item.handle ? "…" : "Uložiť"}
                      </button>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gm-text-muted">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
