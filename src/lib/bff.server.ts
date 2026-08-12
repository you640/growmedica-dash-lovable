// Server-only client for the GrowMedica storefront BFF (dashboard agent API).
// Reads secrets per-request; values never reach the browser.

const SECRET_HEADER = "x-dashboard-agent-secret";

export function getBffConfig() {
  const base = process.env["STOREFRONT_BFF_BASE_URL"]?.trim().replace(/\/+$/, "") ?? "";
  const secret = process.env["DASHBOARD_AGENT_SECRET"]?.trim() ?? "";
  return { base, secret, configured: Boolean(base && secret) };
}

export async function bffGet<T>(
  path: string,
): Promise<{ ok: boolean; status: number; json: T | null }> {
  const { base, secret, configured } = getBffConfig();
  if (!configured) return { ok: false, status: 0, json: null };
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json", [SECRET_HEADER]: secret },
  });
  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }
  if (!res.ok) console.error(`[bff] GET ${path} failed [${res.status}]`);
  return { ok: res.ok, status: res.status, json };
}

export type BffHealth = {
  ok?: boolean;
  cms_provider?: string;
  mistral?: string;
  catalog?: string;
  admin_url?: string;
  write_mode?: string;
};

export type BffOverview = {
  product_count?: number | null;
  collection_count?: number | null;
  low_stock_count?: number | null;
  unavailable_count?: number | null;
  recent_orders?: Array<{
    name?: string;
    total?: string;
    currency?: string;
    financialStatus?: string;
    createdAt?: string;
  }>;
};

export type BffOrder = {
  id?: string;
  name?: string;
  createdAt?: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  total?: string;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  paymentMethod?: string;
};

export type BffProduct = {
  handle?: string;
  title?: string;
  price?: string;
  currency?: string;
  available?: boolean;
};
