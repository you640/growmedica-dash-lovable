import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, RefreshCw, ArrowRight, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { GlassPanel, SectionHeading } from "./AdminShell";
import type { WooCommerceListResult } from "@/lib/woocommerce.functions";

type Props<T> = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  fetchFn: () => Promise<WooCommerceListResult<T>>;
  columns: { key: string; label: string }[];
  renderRow: (item: T) => ReactNode;
  emptyLabel: string;
};

const NOT_CONNECTED_ERRORS = [
  "Chýbajú WooCommerce credentials",
  "Neplatná WooCommerce store URL",
  "musia byť nastavené spolu",
];

export function EcomDataPage<T>({
  title,
  subtitle,
  icon,
  fetchFn,
  columns,
  renderRow,
  emptyLabel,
}: Props<T>) {
  const [state, setState] = useState<"loading" | "ready" | "error" | "not_connected">("loading");
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setState("loading");
    setError(null);
    try {
      const r = await fetchFn();
      if (!r.ok) {
        const notConnected = NOT_CONNECTED_ERRORS.some((s) => (r.error ?? "").includes(s));
        setError(r.error);
        setState(notConnected ? "not_connected" : "error");
        setItems([]);
        return;
      }
      setItems(r.items);
      setState("ready");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
      setItems([]);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <SectionHeading title={title} subtitle={subtitle} />
        <button
          onClick={() => load()}
          disabled={state === "loading"}
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-gm-border bg-white px-4 py-2 text-sm hover:bg-gm-bg-soft disabled:opacity-50 shrink-0"
        >
          {state === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Obnoviť
        </button>
      </div>

      <GlassPanel className="overflow-hidden">
        {state === "loading" && (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-gm-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Načítavam dáta z obchodu…
          </div>
        )}

        {state === "not_connected" && (
          <div className="p-8 flex items-start gap-4">
            <div className="w-12 h-12 rounded-gm-lg bg-(--gm-primary)/10 text-gm-primary flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold">E-shop zatiaľ nie je pripojený</h2>
              <p className="text-sm text-gm-text-muted mt-1 max-w-xl">{error}</p>
              <Link
                to="/admin/nastavenia"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gm-primary text-white px-5 py-2.5 text-sm hover:opacity-90"
              >
                Pripojiť obchod v Nastaveniach
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="p-8 flex items-start gap-4">
            <div className="w-12 h-12 rounded-gm-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Načítanie zlyhalo</h2>
              <p className="text-sm text-gm-text-muted mt-1 max-w-xl">{error}</p>
              <button
                onClick={() => load()}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-gm-border bg-white px-5 py-2.5 text-sm hover:bg-gm-bg-soft"
              >
                Skúsiť znova
              </button>
            </div>
          </div>
        )}

        {state === "ready" && items.length === 0 && (
          <div className="p-10 text-center text-sm text-gm-text-muted">{emptyLabel}</div>
        )}

        {state === "ready" && items.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gm-bg-soft text-gm-text-muted text-xs uppercase tracking-wider">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="text-left px-4 py-3">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{items.map((item) => renderRow(item))}</tbody>
            </table>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
