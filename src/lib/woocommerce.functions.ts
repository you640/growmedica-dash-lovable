import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ShopifyProduct,
  ShopifyOrder,
  ShopifyCustomer,
  ShopifyListResult,
  ShopifyDashboardSummary,
} from "./shopify.functions";

// WooCommerce backend — sealed alongside Shopify (src/lib/shopify.functions.ts),
// which is left completely untouched so it can be revived later. These functions
// re-export the exact Shopify* return types so that swapping listShopifyOrders for
// listWooCommerceOrders (etc.) in the UI needs no frontend changes.
//
// Auth: direct WooCommerce REST API v3 (https://{store}/wp-json/wc/v3/...) via
// Consumer Key/Secret Basic Auth — NOT the Lovable WordPress connector gateway used
// by wordpress.functions.ts, which only exposes simplified blog endpoints (posts/
// pages/media) and cannot be assumed to forward the wc/v3 namespace.

export type WooCommerceProduct = ShopifyProduct;
export type WooCommerceOrder = ShopifyOrder;
export type WooCommerceCustomer = ShopifyCustomer;
export type WooCommerceListResult<T> = ShopifyListResult<T>;
export type WooCommerceDashboardSummary = ShopifyDashboardSummary;

type WooNonSecretCfg = {
  store_url?: string;
};

async function loadNonSecretConfig(): Promise<WooNonSecretCfg> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("provider", "woocommerce")
    .eq("name", "default")
    .maybeSingle();
  const raw = (data?.config ?? {}) as Record<string, unknown>;
  return {
    store_url: typeof raw.store_url === "string" ? raw.store_url : undefined,
  };
}

type ResolvedWooCommerceAuth =
  | { ok: true; storeUrl: string; consumerKey: string; consumerSecret: string }
  | { ok: false; error: string };

/** Shared credential resolution for all WooCommerce Admin REST reads. Never returns secret values. */
async function resolveWooCommerceAuth(): Promise<ResolvedWooCommerceAuth> {
  const { normalizeStoreUrl } = await import("./woocommerce-client.server");

  const cfg = await loadNonSecretConfig();
  const storeUrl = normalizeStoreUrl(cfg.store_url || process.env.WOOCOMMERCE_STORE_URL);
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY?.trim() ?? "";
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET?.trim() ?? "";

  if (!storeUrl) {
    return {
      ok: false,
      error: "Neplatná WooCommerce store URL — nastavte ju v Nastaveniach (https:// URL).",
    };
  }

  const hasKey = consumerKey.length > 0;
  const hasSecret = consumerSecret.length > 0;

  if (hasKey !== hasSecret) {
    return {
      ok: false,
      error: "WOOCOMMERCE_CONSUMER_KEY a WOOCOMMERCE_CONSUMER_SECRET musia byť nastavené spolu.",
    };
  }
  if (!hasKey || !hasSecret) {
    return {
      ok: false,
      error: "Chýbajú WooCommerce credentials — nastavte WOOCOMMERCE_CONSUMER_KEY + SECRET.",
    };
  }

  return { ok: true, storeUrl, consumerKey, consumerSecret };
}

function toIso(dateGmt: string | undefined | null): string {
  if (!dateGmt) return "";
  return dateGmt.endsWith("Z") ? dateGmt : `${dateGmt}Z`;
}

function mapWooProductStatus(status: string | undefined): string {
  if (status === "publish") return "ACTIVE";
  if (status === "draft") return "DRAFT";
  // pending, private, trash, future — no clean Shopify equivalent, bucket as archived.
  return "ARCHIVED";
}

function mapWooOrderStatus(status: string | undefined): {
  financialStatus: string;
  fulfillmentStatus: string;
} {
  switch (status) {
    case "completed":
      return { financialStatus: "paid", fulfillmentStatus: "fulfilled" };
    case "processing":
      return { financialStatus: "paid", fulfillmentStatus: "unfulfilled" };
    case "on-hold":
    case "pending":
      return { financialStatus: "pending", fulfillmentStatus: "unfulfilled" };
    case "refunded":
      return { financialStatus: "refunded", fulfillmentStatus: "unfulfilled" };
    case "cancelled":
    case "failed":
      return { financialStatus: "voided", fulfillmentStatus: "unfulfilled" };
    default:
      // WooCommerce allows custom order statuses (plugins, subscriptions) — pass through raw.
      return { financialStatus: status ?? "unknown", fulfillmentStatus: "unfulfilled" };
  }
}

const PRODUCTS_QUERY = { per_page: 50, orderby: "modified", order: "desc" } as const;

export const listWooCommerceProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WooCommerceListResult<WooCommerceProduct>> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);

    const auth = await resolveWooCommerceAuth();
    if (!auth.ok) return { ok: false, items: [], error: auth.error };

    try {
      const { wooFetch, getStoreCurrency } = await import("./woocommerce-client.server");
      const [r, currency] = await Promise.all([
        wooFetch<
          Array<{
            id: number;
            name: string;
            status: string;
            stock_quantity: number | null;
            price: string;
            date_modified_gmt: string;
          }>
        >({ ...auth, path: "/products", query: PRODUCTS_QUERY }),
        getStoreCurrency(auth),
      ]);

      if (!r.ok || !Array.isArray(r.json)) {
        return { ok: false, items: [], error: `Admin API HTTP ${r.status}` };
      }

      const items: WooCommerceProduct[] = r.json.map((p) => ({
        id: String(p.id ?? ""),
        title: String(p.name ?? ""),
        status: mapWooProductStatus(p.status),
        totalInventory: Number(p.stock_quantity ?? 0),
        price: p.price || null,
        currency,
        updatedAt: toIso(p.date_modified_gmt),
      }));
      return { ok: true, items, error: null };
    } catch (e) {
      console.error("[woocommerce:products]", { message: (e as Error).message });
      return { ok: false, items: [], error: "Sieťová alebo runtime chyba pri WooCommerce API." };
    }
  });

const ORDERS_QUERY = { per_page: 50, orderby: "date", order: "desc" } as const;

export const listWooCommerceOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WooCommerceListResult<WooCommerceOrder>> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);

    const auth = await resolveWooCommerceAuth();
    if (!auth.ok) return { ok: false, items: [], error: auth.error };

    try {
      const { wooFetch } = await import("./woocommerce-client.server");
      const r = await wooFetch<
        Array<{
          id: number;
          number: string;
          status: string;
          currency: string;
          total: string;
          date_created_gmt: string;
          billing?: { first_name?: string; last_name?: string; company?: string };
        }>
      >({ ...auth, path: "/orders", query: ORDERS_QUERY });

      if (!r.ok || !Array.isArray(r.json)) {
        return { ok: false, items: [], error: `Admin API HTTP ${r.status}` };
      }

      const items: WooCommerceOrder[] = r.json.map((o) => {
        const { financialStatus, fulfillmentStatus } = mapWooOrderStatus(o.status);
        const billingName = `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim();
        return {
          id: String(o.id ?? ""),
          name: `#${o.number ?? o.id}`,
          customer: billingName || o.billing?.company || null,
          total: o.total || null,
          currency: o.currency || null,
          financialStatus,
          fulfillmentStatus,
          createdAt: toIso(o.date_created_gmt),
        };
      });
      return { ok: true, items, error: null };
    } catch (e) {
      console.error("[woocommerce:orders]", { message: (e as Error).message });
      return { ok: false, items: [], error: "Sieťová alebo runtime chyba pri WooCommerce API." };
    }
  });

const CUSTOMERS_QUERY = { per_page: 50, orderby: "registered_date", order: "desc" } as const;

export const listWooCommerceCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WooCommerceListResult<WooCommerceCustomer>> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);

    const auth = await resolveWooCommerceAuth();
    if (!auth.ok) return { ok: false, items: [], error: auth.error };

    try {
      const { wooFetch, getStoreCurrency } = await import("./woocommerce-client.server");
      const [r, currency] = await Promise.all([
        wooFetch<
          Array<{
            id: number;
            first_name: string;
            last_name: string;
            email: string;
            orders_count: number;
            total_spent: string;
            date_created_gmt: string;
          }>
        >({ ...auth, path: "/customers", query: CUSTOMERS_QUERY }),
        getStoreCurrency(auth),
      ]);

      if (!r.ok || !Array.isArray(r.json)) {
        return { ok: false, items: [], error: `Admin API HTTP ${r.status}` };
      }

      const items: WooCommerceCustomer[] = r.json.map((c) => ({
        id: String(c.id ?? ""),
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
        email: c.email || null,
        ordersCount: Number(c.orders_count ?? 0),
        totalSpent: c.total_spent || null,
        currency,
        createdAt: toIso(c.date_created_gmt),
      }));
      return { ok: true, items, error: null };
    } catch (e) {
      console.error("[woocommerce:customers]", { message: (e as Error).message });
      return { ok: false, items: [], error: "Sieťová alebo runtime chyba pri WooCommerce API." };
    }
  });

export const getWooCommerceDashboardSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WooCommerceDashboardSummary> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);

    const auth = await resolveWooCommerceAuth();
    if (!auth.ok) {
      return {
        ok: false,
        productsCount: null,
        ordersTodayCount: null,
        customersCount: null,
        error: auth.error,
      };
    }

    try {
      const { wooFetch } = await import("./woocommerce-client.server");
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [products, customers, ordersToday] = await Promise.all([
        wooFetch({ ...auth, path: "/products", query: { per_page: 1 } }),
        wooFetch({ ...auth, path: "/customers", query: { per_page: 1 } }),
        wooFetch({
          ...auth,
          path: "/orders",
          query: { per_page: 1, after: startOfDay.toISOString() },
        }),
      ]);

      if (!products.ok || !customers.ok || !ordersToday.ok) {
        return {
          ok: false,
          productsCount: null,
          ordersTodayCount: null,
          customersCount: null,
          error: "Admin API vrátilo chybu pri načítaní súhrnu.",
        };
      }

      return {
        ok: true,
        productsCount: products.totalItems,
        ordersTodayCount: ordersToday.totalItems,
        customersCount: customers.totalItems,
        error: null,
      };
    } catch (e) {
      console.error("[woocommerce:summary]", { message: (e as Error).message });
      return {
        ok: false,
        productsCount: null,
        ordersTodayCount: null,
        customersCount: null,
        error: "Sieťová alebo runtime chyba pri WooCommerce API.",
      };
    }
  });
