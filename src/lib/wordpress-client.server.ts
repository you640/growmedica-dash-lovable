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
  return !!process.env.LOVABLE_API_KEY?.trim() && !!process.env.WORDPRESS_API_KEY?.trim();
}

export async function wpFetch<T = unknown>(
  path: string,
  init: { method?: string; query?: Record<string, string | number>; body?: unknown } = {},
): Promise<WpCallResult<T>> {
  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  const connKey = process.env.WORDPRESS_API_KEY?.trim();
  if (!lovableKey || !connKey) {
    throw new Error("WordPress connector nie je pripojený (chýba connection key).");
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) qs.set(k, String(v));
  const url = `${GATEWAY_URL}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
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
