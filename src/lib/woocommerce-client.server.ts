// Server-only WooCommerce REST API v3 client.
// - Validates store URL (https only, no SSRF surface via creds/query/fragment)
// - Basic Auth via Consumer Key/Secret (standard WooCommerce REST API v3 auth)
// - Redacted logging: never echoes keys, secrets, or raw upstream bodies

const REQUEST_TIMEOUT_MS = 10_000;

/** Reject protocols other than https, and any creds/query/fragment baked into the URL. */
export function normalizeStoreUrl(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, "");
  return `https://${url.host}${path}`;
}

export type WooCallResult<T = unknown> = {
  status: number;
  ok: boolean;
  json: T | null;
  text: string | null;
  totalItems: number | null;
  totalPages: number | null;
};

export async function wooFetch<T = unknown>(opts: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  path: string;
  query?: Record<string, string | number>;
}): Promise<WooCallResult<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) qs.set(k, String(v));
  const url = `${opts.storeUrl}/wp-json/wc/v3${opts.path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  const basicAuth = btoa(`${opts.consumerKey}:${opts.consumerSecret}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error("[woocommerce:fetch] network", { name: (e as Error).name, path: opts.path });
    throw new Error("WooCommerce REST API: network error");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    console.error(`[woocommerce:fetch] ${opts.path} failed [${res.status}]`);
  }

  const totalItems = Number(res.headers.get("x-wp-total"));
  const totalPages = Number(res.headers.get("x-wp-totalpages"));

  return {
    status: res.status,
    ok: res.ok,
    json,
    text: json ? null : text.slice(0, 400),
    totalItems: Number.isFinite(totalItems) && totalItems >= 0 ? totalItems : null,
    totalPages: Number.isFinite(totalPages) && totalPages >= 0 ? totalPages : null,
  };
}

type CurrencyCacheEntry = { code: string; expiresAt: number };
const currencyCache = new Map<string, CurrencyCacheEntry>();
const CURRENCY_TTL_MS = 10 * 60 * 1000;

/**
 * WooCommerce product/customer objects don't carry a per-item currency (unlike orders,
 * which do) — it's a store-wide setting. Cached per store to avoid an extra round trip
 * on every list call.
 */
export async function getStoreCurrency(opts: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): Promise<string | null> {
  const key = `${opts.storeUrl}::${opts.consumerKey}`;
  const cached = currencyCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.code;

  const r = await wooFetch<{ code?: string }>({
    ...opts,
    path: "/data/currencies/current",
  });
  const code = r.ok && typeof r.json?.code === "string" ? r.json.code : null;
  if (code) currencyCache.set(key, { code, expiresAt: now + CURRENCY_TTL_MS });
  return code;
}

/** For tests only. */
export function _resetWooCommerceCurrencyCache(): void {
  currencyCache.clear();
}
