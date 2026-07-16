import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Shopify test connection — API 2026-07 with server-side client credentials.
// Secrets (SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET / legacy SHOPIFY_ADMIN_ACCESS_TOKEN)
// live only in server env; the integrations.config row keeps only the
// non-secret domain / api_version. Nothing secret is ever returned to callers.

type ShopifyNonSecretCfg = {
  store_domain?: string;
  api_version?: string;
};

async function loadNonSecretConfig(): Promise<ShopifyNonSecretCfg> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("provider", "shopify")
    .eq("name", "default")
    .maybeSingle();
  const raw = (data?.config ?? {}) as Record<string, unknown>;
  return {
    store_domain: typeof raw.store_domain === "string" ? raw.store_domain : undefined,
    api_version: typeof raw.api_version === "string" ? raw.api_version : undefined,
  };
}

export type AuthMode = "client_credentials" | "legacy_admin_token" | "none" | "partial";

export type ShopifyTestResult = {
  ok: boolean;
  domain: string | null;
  apiVersion: string;
  apiVersionHeader: string | null;
  versionOk: boolean;
  shopName: string | null;
  myshopifyDomain: string | null;
  scopes: string[];
  missingScopes: string[];
  authMode: AuthMode;
  error: string | null;
};

/** Returns booleans about which server-only secrets are configured. Never returns values. */
export const getShopifyAuthStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { normalizeStoreDomain, normalizeApiVersion, DEFAULT_API_VERSION } =
      await import("./shopify-client.server");
    const cfg = await loadNonSecretConfig();
    const domain = normalizeStoreDomain(
      cfg.store_domain || process.env.SHOPIFY_STORE_DOMAIN
    );
    const apiVersion = normalizeApiVersion(
      cfg.api_version || process.env.SHOPIFY_API_VERSION
    );
    const hasClientId = !!process.env.SHOPIFY_CLIENT_ID?.trim();
    const hasClientSecret = !!process.env.SHOPIFY_CLIENT_SECRET?.trim();
    const hasLegacyAdminToken = !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim();
    const authMode: AuthMode =
      hasClientId && hasClientSecret
        ? "client_credentials"
        : hasClientId !== hasClientSecret
        ? "partial"
        : hasLegacyAdminToken
        ? "legacy_admin_token"
        : "none";
    return {
      domain,
      apiVersion,
      requiredApiVersion: DEFAULT_API_VERSION,
      hasClientId,
      hasClientSecret,
      hasLegacyAdminToken,
      authMode,
      domainSource: cfg.store_domain ? "config" : process.env.SHOPIFY_STORE_DOMAIN ? "env" : "missing",
    };
  });

export const testShopifyConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShopifyTestResult> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);

    const {
      normalizeStoreDomain,
      normalizeApiVersion,
      adminGraphQL,
      adminGraphQLWithCredentials,
      TEST_CONNECTION_QUERY,
      REQUIRED_API_VERSION,
      REQUIRED_SCOPES,
    } = await import("./shopify-client.server");

    const cfg = await loadNonSecretConfig();
    const domain = normalizeStoreDomain(
      cfg.store_domain || process.env.SHOPIFY_STORE_DOMAIN
    );
    const apiVersion = normalizeApiVersion(
      cfg.api_version || process.env.SHOPIFY_API_VERSION
    );
    const clientId = process.env.SHOPIFY_CLIENT_ID?.trim() ?? "";
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim() ?? "";
    const legacyToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() ?? "";

    const baseFail = (
      error: string,
      authMode: AuthMode = "none"
    ): ShopifyTestResult => ({
      ok: false,
      domain,
      apiVersion,
      apiVersionHeader: null,
      versionOk: false,
      shopName: null,
      myshopifyDomain: null,
      scopes: [],
      missingScopes: [...REQUIRED_SCOPES],
      authMode,
      error,
    });

    if (!domain) {
      return baseFail(
        "Neplatný Shopify store domain — očakávam bare *.myshopify.com hostname."
      );
    }

    const hasId = clientId.length > 0;
    const hasSecret = clientSecret.length > 0;

    // Partial pair → fail closed, never silently fall back.
    if (hasId !== hasSecret) {
      return baseFail(
        "SHOPIFY_CLIENT_ID a SHOPIFY_CLIENT_SECRET musia byť nastavené spolu.",
        "partial"
      );
    }

    let authMode: AuthMode;
    let call: () => Promise<
      Awaited<ReturnType<typeof adminGraphQL>>
    >;

    if (hasId && hasSecret) {
      authMode = "client_credentials";
      call = () =>
        adminGraphQLWithCredentials({
          domain,
          apiVersion,
          clientId,
          clientSecret,
          query: TEST_CONNECTION_QUERY,
        });
    } else if (legacyToken) {
      authMode = "legacy_admin_token";
      call = () =>
        adminGraphQL({
          domain,
          apiVersion,
          token: legacyToken,
          query: TEST_CONNECTION_QUERY,
        });
    } else {
      return baseFail(
        "Chýbajú Shopify credentials — nastavte SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET.",
        "none"
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let result: ShopifyTestResult;
    try {
      const r = await call();
      const apiVersionHeader = r.apiVersionHeader;
      const versionOk = (apiVersionHeader ?? "").trim() === REQUIRED_API_VERSION;

      if (r.status !== 200) {
        result = {
          ...baseFail(`Admin API HTTP ${r.status}`, authMode),
          apiVersionHeader,
          versionOk,
        };
      } else {
        const shop = r.json?.data?.shop ?? null;
        const rawScopes = Array.isArray(
          r.json?.data?.currentAppInstallation?.accessScopes
        )
          ? r.json.data.currentAppInstallation.accessScopes
          : [];
        const scopes: string[] = rawScopes
          .map((s: unknown) =>
            s && typeof s === "object" && "handle" in s
              ? String((s as { handle: unknown }).handle ?? "")
              : ""
          )
          .filter((s: string) => s.length > 0);
        const missingScopes = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
        const shopName = typeof shop?.name === "string" ? shop.name : null;
        const myshopifyDomain =
          typeof shop?.myshopifyDomain === "string" ? shop.myshopifyDomain : null;

        const ok = !!shopName && missingScopes.length === 0 && versionOk;
        const error = !versionOk
          ? `Shopify vrátil X-Shopify-API-Version="${apiVersionHeader ?? ""}", očakávané ${REQUIRED_API_VERSION}.`
          : missingScopes.length > 0
          ? `Chýbajú scopes: ${missingScopes.join(", ")}`
          : !shopName
          ? "Admin API neposlalo shop.name."
          : null;

        result = {
          ok,
          domain,
          apiVersion,
          apiVersionHeader,
          versionOk,
          shopName,
          myshopifyDomain,
          scopes,
          missingScopes,
          authMode,
          error,
        };
      }
    } catch (e) {
      console.error("[shopify:test]", {
        name: (e as Error).name,
        message: (e as Error).message,
      });
      result = baseFail("Sieťová alebo runtime chyba pri Admin API.", authMode);
    }

    try {
      await supabaseAdmin.from("integrations").upsert(
        {
          provider: "shopify",
          name: "default",
          status: result.ok ? "connected" : "error",
          last_tested_at: new Date().toISOString(),
          last_error: result.ok ? null : result.error,
        },
        { onConflict: "provider,name" }
      );
    } catch (e) {
      console.error("[shopify:test:status-write]", {
        message: (e as Error).message,
      });
    }

    return result;
  });