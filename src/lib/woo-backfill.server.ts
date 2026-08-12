// Server-only WooCommerce backfill.
// Products come from the WordPress REST API (`product` post type) through the
// Lovable connector, enriched with live price/stock from the storefront BFF.
// Orders come from the storefront BFF (Woo REST is not exposed via the WP connector).
// Customers are derived from real order data (email is the identity key).
// No mock data is ever written.

import { applyWordPressEvent } from "./wp-sync.server";
import { bffGet, getBffConfig, type BffOrder, type BffProduct } from "./bff.server";
import { wpFetch, hasWordPressConnection } from "./wordpress-client.server";

export type BackfillPart = { kind: string; imported: number; error?: string; note?: string };

function stableId(input: string): number {
  // FNV-1a 32-bit — deterministic surrogate id for customers without a Woo id.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

async function loadBffPriceMap(): Promise<Map<string, BffProduct>> {
  // The dashboard API ignores `offset` and caps the page size, so one call is enough.
  const map = new Map<string, BffProduct>();
  const { configured } = getBffConfig();
  if (!configured) return map;
  const r = await bffGet<{ products?: BffProduct[] }>("/api/dashboard/products?limit=500");
  for (const p of r.json?.products ?? []) if (p.handle) map.set(p.handle, p);
  return map;
}

export async function backfillProducts(): Promise<BackfillPart> {
  if (!hasWordPressConnection()) {
    return { kind: "products", imported: 0, error: "WordPress konektor nie je pripojený." };
  }
  const prices = await loadBffPriceMap();
  let imported = 0;
  try {
    for (let page = 1; page <= 10; page++) {
      const r = await wpFetch<Array<Record<string, unknown>>>("/product", {
        query: { per_page: 100, page, status: "any", _embed: "wp:featuredmedia" },
      });
      if (!r.ok || !Array.isArray(r.json) || r.json.length === 0) break;
      for (const item of r.json) {
        const slug = typeof item.slug === "string" ? item.slug : "";
        const live = prices.get(slug);
        const embedded = item._embedded as { "wp:featuredmedia"?: Array<{ source_url?: string }> } | undefined;
        const image = embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null;
        const classList = Array.isArray(item.class_list) ? (item.class_list as string[]) : [];
        const stockStatus = classList.includes("outofstock")
          ? "outofstock"
          : classList.includes("onbackorder")
            ? "onbackorder"
            : classList.includes("instock")
              ? "instock"
              : live?.available === false
                ? "outofstock"
                : live
                  ? "instock"
                  : null;
        await applyWordPressEvent("product.updated", {
          ...item,
          image_url: image,
          price: live?.price ?? null,
          stock_status: stockStatus,
        });
        imported++;
      }
      if (r.json.length < 100) break;
    }
  } catch (e) {
    console.error("[woo:backfill:products]", { message: (e as Error).message });
    return { kind: "products", imported, error: "Import produktov zlyhal." };
  }
  return { kind: "products", imported };
}

async function fetchOrders(): Promise<{ orders: BffOrder[]; error?: string }> {
  const { configured } = getBffConfig();
  if (!configured) {
    return {
      orders: [],
      error: "Chýba STOREFRONT_BFF_BASE_URL alebo DASHBOARD_AGENT_SECRET.",
    };
  }
  const r = await bffGet<{ orders?: BffOrder[] }>("/api/dashboard/orders?limit=500");
  if (!r.ok) return { orders: [], error: `Storefront API vrátilo ${r.status}.` };
  return { orders: r.json?.orders ?? [] };
}

export async function backfillOrders(): Promise<BackfillPart> {
  const { orders, error } = await fetchOrders();
  if (error) return { kind: "orders", imported: 0, error };
  let imported = 0;
  for (const o of orders) {
    const id = Number(o.id);
    if (!Number.isFinite(id)) continue;
    await applyWordPressEvent("order.updated", {
      id,
      number: o.name?.replace(/^#/, "") ?? String(id),
      status: o.financialStatus ?? null,
      currency: o.currency ?? null,
      total: o.total ?? null,
      customer_email: o.customerEmail ?? null,
      customer_name: o.customerName ?? null,
      payment_method_title: o.paymentMethod ?? null,
      date_created: o.createdAt ?? null,
    });
    imported++;
  }
  return {
    kind: "orders",
    imported,
    ...(imported === 0 ? { note: "V obchode zatiaľ nie sú žiadne objednávky." } : {}),
  };
}

export async function backfillCustomers(): Promise<BackfillPart> {
  const { orders, error } = await fetchOrders();
  if (error) return { kind: "customers", imported: 0, error };

  type Agg = { email: string; name: string; count: number; total: number; first: string | null };
  const byEmail = new Map<string, Agg>();
  for (const o of orders) {
    const email = o.customerEmail?.trim().toLowerCase();
    if (!email) continue;
    const agg = byEmail.get(email) ?? {
      email,
      name: o.customerName ?? "",
      count: 0,
      total: 0,
      first: null,
    };
    agg.count++;
    agg.total += Number(o.total) || 0;
    if (o.createdAt && (!agg.first || o.createdAt < agg.first)) agg.first = o.createdAt;
    if (!agg.name && o.customerName) agg.name = o.customerName;
    byEmail.set(email, agg);
  }

  let imported = 0;
  for (const a of byEmail.values()) {
    const [first, ...rest] = a.name.split(" ").filter(Boolean);
    await applyWordPressEvent("customer.updated", {
      id: stableId(a.email),
      email: a.email,
      first_name: first ?? null,
      last_name: rest.join(" ") || null,
      orders_count: a.count,
      total_spent: Number(a.total.toFixed(2)),
      date_created: a.first,
    });
    imported++;
  }
  return {
    kind: "customers",
    imported,
    ...(imported === 0 ? { note: "Z objednávok sa nedali odvodiť žiadni zákazníci." } : {}),
  };
}

export async function runWooBackfill(kinds: string[]): Promise<BackfillPart[]> {
  const parts: BackfillPart[] = [];
  if (kinds.includes("products")) parts.push(await backfillProducts());
  if (kinds.includes("orders")) parts.push(await backfillOrders());
  if (kinds.includes("customers")) parts.push(await backfillCustomers());
  return parts;
}
