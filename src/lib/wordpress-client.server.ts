// WordPress REST API client via the Lovable connector gateway.
// Credentials (site URL + application password) live in the connector
// connection; only LOVABLE_API_KEY + WORDPRESS_API_KEY are read here and
// are never returned to callers.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/wordpress";

export type WpCallResult<T = unknown> = {
  status: number;
  ok: boolean;
  json: T | null;
  text: string | null;
  totalItems: number | null;
  totalPages: number | null;
};

export function hasWordPressConnection(): boolean {
  const hasLovableConnector =
    !!process.env.LOVABLE_API_KEY?.trim() && !!process.env.WORDPRESS_API_KEY?.trim();
  const hasDirectStore = !!process.env.WOOCOMMERCE_STORE_URL?.trim();
  const hasDb = !!process.env.WP_DB_HOST?.trim();
  return hasLovableConnector || hasDirectStore || hasDb;
}

export async function wpFetch<T = unknown>(
  path: string,
  init: { method?: string; query?: Record<string, string | number>; body?: unknown } = {},
): Promise<WpCallResult<T>> {
  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  const connKey = process.env.WORDPRESS_API_KEY?.trim();
  const storeUrl = process.env.WOOCOMMERCE_STORE_URL?.trim().replace(/\/$/, "");
  const ck = process.env.WOOCOMMERCE_CONSUMER_KEY?.trim();
  const cs = process.env.WOOCOMMERCE_CONSUMER_SECRET?.trim();

  let url: string;
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
  };

  if (lovableKey && connKey) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query ?? {})) qs.set(k, String(v));
    url = `${GATEWAY_URL}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
    headers["Authorization"] = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = connKey;
  } else if (storeUrl) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query ?? {})) qs.set(k, String(v));
    url = `${storeUrl}/wp-json/wp/v2${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
    if (ck && cs) {
      headers["Authorization"] = `Basic ${Buffer.from(`${ck}:${cs}`).toString("base64")}`;
    }
  } else {
    throw new Error(
      "WordPress konektor nie je pripojený (chýba LOVABLE_API_KEY alebo WOOCOMMERCE_STORE_URL).",
    );
  }

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await res.text();
  let json: T | null = null;
  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }

  const totalItems = Number(res.headers.get("x-wp-total"));
  const totalPages = Number(res.headers.get("x-wp-totalpages"));

  if (!res.ok) {
    console.error(`[wordpress] ${init.method ?? "GET"} ${path} failed [${res.status}]`);
  }

  return {
    status: res.status,
    ok: res.ok,
    json,
    text: json ? null : text.slice(0, 400),
    totalItems: Number.isFinite(totalItems) && totalItems > 0 ? totalItems : null,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : null,
  };
}

export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
