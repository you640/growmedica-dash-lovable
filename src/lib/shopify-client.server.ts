// Server-only Shopify Admin client.
// - Validates store domain (myshopify.com only, no SSRF surface)
// - Handles client-credentials token exchange with cached, deduped refresh
// - Redacted logging: never echoes tokens, secrets, or raw upstream bodies

export const DEFAULT_API_VERSION = "2026-07";
export const REQUIRED_API_VERSION = "2026-07";
export const REQUIRED_SCOPES = [
  "read_products",
  "write_products",
  "read_inventory",
  "write_inventory",
] as const;

const DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const VERSION_RE = /^\d{4}-\d{2}$/;
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Reject protocols, paths, ports, credentials, query — only bare *.myshopify.com. */
export function normalizeStoreDomain(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = String(input).trim().toLowerCase();
  if (!trimmed) return null;
  // Any of these chars indicates protocol/path/creds/port/query/fragment → reject.
  if (/[\s/\\:@?#]/.test(trimmed)) return null;
  if (!DOMAIN_RE.test(trimmed)) return null;
  return trimmed;
}

export function normalizeApiVersion(input: string | undefined | null): string {
  if (input && VERSION_RE.test(String(input).trim())) return String(input).trim();
  return DEFAULT_API_VERSION;
}

type CacheEntry = { token: string; expiresAt: number; scope: string };
const tokenCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function cacheKey(domain: string, clientId: string): string {
  return `${domain}::${clientId}`;
}

async function exchangeToken(
  domain: string,
  clientId: string,
  clientSecret: string,
): Promise<CacheEntry> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error("[shopify:token-exchange] network", {
      name: (e as Error).name,
    });
    throw new Error("Shopify token exchange: network error");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    console.error("[shopify:token-exchange] http", { status: res.status });
    throw new Error(`Shopify token exchange failed (HTTP ${res.status})`);
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof json.access_token === "string" ? json.access_token : "";
  const expiresIn =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
      ? Math.max(60, json.expires_in)
      : 3600;
  const scope = typeof json.scope === "string" ? json.scope : "";
  if (!token) {
    console.error("[shopify:token-exchange] missing_access_token");
    throw new Error("Shopify token exchange returned no access_token");
  }
  return { token, expiresAt: Date.now() + expiresIn * 1000, scope };
}

export async function getAccessToken(
  domain: string,
  clientId: string,
  clientSecret: string,
  force = false,
): Promise<CacheEntry> {
  const key = cacheKey(domain, clientId);
  const now = Date.now();
  if (!force) {
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > now) return cached;
    const pending = inflight.get(key);
    if (pending) return pending;
  }
  const p = exchangeToken(domain, clientId, clientSecret)
    .then((entry) => {
      tokenCache.set(key, entry);
      return entry;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function invalidateToken(domain: string, clientId: string): void {
  tokenCache.delete(cacheKey(domain, clientId));
}

/** For tests only. */
export function _resetShopifyTokenCache(): void {
  tokenCache.clear();
  inflight.clear();
}

export type ShopifyAdminResponse = {
  status: number;
  apiVersionHeader: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
};

export async function adminGraphQL(opts: {
  domain: string;
  apiVersion: string;
  token: string;
  query: string;
}): Promise<ShopifyAdminResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${opts.domain}/admin/api/${opts.apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": opts.token,
        Accept: "application/json",
      },
      body: JSON.stringify({ query: opts.query }),
      signal: ctrl.signal,
    });
    // Case-insensitive header lookup.
    let apiVersionHeader: string | null = null;
    res.headers.forEach((value, key) => {
      if (key.toLowerCase() === "x-shopify-api-version") apiVersionHeader = value;
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, apiVersionHeader, json };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a query using client credentials with automatic one-shot 401 refresh.
 * On a single 401, invalidates the cached token, refreshes, and retries once.
 */
export async function adminGraphQLWithCredentials(opts: {
  domain: string;
  apiVersion: string;
  clientId: string;
  clientSecret: string;
  query: string;
}): Promise<ShopifyAdminResponse> {
  const { domain, apiVersion, clientId, clientSecret, query } = opts;
  const first = await getAccessToken(domain, clientId, clientSecret);
  const r1 = await adminGraphQL({ domain, apiVersion, token: first.token, query });
  if (r1.status !== 401) return r1;
  invalidateToken(domain, clientId);
  const refreshed = await getAccessToken(domain, clientId, clientSecret, true);
  return adminGraphQL({ domain, apiVersion, token: refreshed.token, query });
}

export const TEST_CONNECTION_QUERY = `{
  shop { name myshopifyDomain }
  currentAppInstallation { accessScopes { handle } }
}`;
