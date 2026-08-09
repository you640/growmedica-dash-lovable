// Server-only proxy to GrowMedica storefront /api/dashboard/*.
// Secrets stay in process.env — never import this from client components.

const SECRET_HEADER = "x-dashboard-agent-secret";

export type BffResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

export function getStorefrontBffConfig(): {
  baseUrl: string | null;
  secret: string | null;
  configured: boolean;
} {
  const baseUrl = process.env.STOREFRONT_BFF_BASE_URL?.trim() || null;
  const secret = process.env.DASHBOARD_AGENT_SECRET?.trim() || null;
  return {
    baseUrl: baseUrl ? trimBase(baseUrl) : null,
    secret,
    configured: Boolean(baseUrl && secret && secret.length >= 16),
  };
}

export function hasStorefrontBff(): boolean {
  return getStorefrontBffConfig().configured;
}

/**
 * Server-to-server fetch against storefront dashboard BFF.
 * `path` must start with `/api/dashboard`.
 */
export async function bffFetch<T = unknown>(
  path: string,
  init: {
    method?: string;
    query?: Record<string, string | number | undefined | null>;
    body?: unknown;
    /** When false, omit secret (only useful for soft public health). Default true. */
    withSecret?: boolean;
  } = {},
): Promise<BffResult<T>> {
  const { baseUrl, secret, configured } = getStorefrontBffConfig();
  const withSecret = init.withSecret !== false;

  if (!baseUrl) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "STOREFRONT_BFF_BASE_URL nie je nastavené.",
    };
  }
  if (withSecret && (!secret || secret.length < 16)) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "DASHBOARD_AGENT_SECRET chýba alebo je príliš krátky (≥16).",
    };
  }
  if (withSecret && !configured) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Storefront BFF nie je nakonfigurovaný.",
    };
  }

  if (!path.startsWith("/api/dashboard")) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Neplatná BFF cesta (očakáva sa /api/dashboard…).",
    };
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const url = `${baseUrl}${path}${qs.toString() ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(withSecret && secret ? { [SECRET_HEADER]: secret } : {}),
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const msg =
        json &&
        typeof json === "object" &&
        json !== null &&
        "error" in json &&
        typeof (json as { error: unknown }).error === "string"
          ? (json as { error: string }).error
          : res.status === 401
            ? "BFF unauthorized — skontroluj DASHBOARD_AGENT_SECRET."
            : `Storefront BFF HTTP ${res.status}`;
      return { ok: false, status: res.status, data: (json as T) ?? null, error: msg };
    }

    return { ok: true, status: res.status, data: json as T, error: null };
  } catch (e) {
    console.error("[storefront-bff]", { path, message: (e as Error).message });
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Storefront BFF nedostupný (sieťová chyba).",
    };
  }
}
