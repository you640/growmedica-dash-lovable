import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardHealth = {
  ok: boolean;
  cms_provider?: string;
  mistral?: string;
  catalog?: string;
  admin?: string;
  admin_url?: string;
  write_mode?: string;
  redis?: boolean;
  configured?: boolean;
  error?: string | null;
};

export type DashboardOverview = {
  product_count: number;
  collection_count: number;
  low_stock_count: number | null;
  unavailable_count: number;
  recent_orders: Array<{
    name: string;
    total: string;
    currency: string;
    financialStatus: string;
    createdAt: string;
  }>;
  recent_audit: unknown[];
  note?: string;
  admin?: string;
};

export type DashboardProductRow = {
  handle: string;
  title: string;
  price: string;
  currency: string;
  available: boolean;
};

export type DashboardInventoryRow = {
  id: number;
  handle: string;
  title: string;
  quantity: number | null;
  available: boolean;
  stock_status: string;
  sku: string | null;
};

export const dashboardHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardHealth> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch, getStorefrontBffConfig } = await import("./storefront-bff.server");
    const cfg = getStorefrontBffConfig();

    let result: DashboardHealth;
    if (!cfg.configured) {
      result = {
        ok: false,
        configured: false,
        error: "STOREFRONT_BFF_BASE_URL alebo DASHBOARD_AGENT_SECRET chýba.",
      };
    } else {
      const r = await bffFetch<DashboardHealth>("/api/dashboard/health");
      result =
        !r.ok || !r.data
          ? { ok: false, configured: true, error: r.error }
          : { ...r.data, ok: true, configured: true, error: null };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const now = new Date().toISOString();
      await supabaseAdmin.from("integrations").upsert(
        {
          provider: "storefront_bff",
          name: "default",
          status: result.ok ? "connected" : "error",
          last_tested_at: now,
          last_error: result.ok ? null : (result.error ?? "health failed"),
          config: {
            catalog: result.catalog ?? null,
            write_mode: result.write_mode ?? null,
            mistral: result.mistral ?? null,
            cms_provider: result.cms_provider ?? null,
          },
        },
        { onConflict: "provider,name" },
      );
      const mistralOk = result.mistral === "configured" || result.mistral === "mock";
      await supabaseAdmin.from("integrations").upsert(
        {
          provider: "mistral_ai",
          name: "default",
          status: result.ok && mistralOk ? "connected" : result.ok ? "error" : "disconnected",
          last_tested_at: now,
          last_error:
            result.ok && mistralOk
              ? null
              : `mistral=${result.mistral ?? "missing"} (via storefront BFF health)`,
          config: { mistral: result.mistral ?? null, source: "storefront_bff_health" },
        },
        { onConflict: "provider,name" },
      );
    } catch (e) {
      console.error("[storefront-bff:health:status-write]", { message: (e as Error).message });
    }

    return result;
  });

export const dashboardOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const r = await bffFetch<DashboardOverview>("/api/dashboard/overview");
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Nepodarilo sa načítať overview.");
    }
    return r.data;
  });

export const dashboardProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const r = await bffFetch<{
      products: DashboardProductRow[];
      count: number;
      admin?: string;
    }>("/api/dashboard/products", {
      query: { search: data.search, limit: data.limit },
    });
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Nepodarilo sa načítať produkty.");
    }
    return r.data;
  });

export const dashboardProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ handle: z.string().trim().min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const handle = encodeURIComponent(data.handle);
    const r = await bffFetch<{ product: Record<string, unknown> }>(
      `/api/dashboard/products/${handle}`,
    );
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Produkt nenájdený.");
    }
    return r.data;
  });

export const dashboardInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(50),
        threshold: z.number().int().min(0).max(100000).default(100),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const r = await bffFetch<{
      items: DashboardInventoryRow[];
      count: number;
      note?: string;
      admin?: string;
    }>("/api/dashboard/inventory", {
      query: { limit: data.limit, threshold: data.threshold },
    });
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Nepodarilo sa načítať inventár.");
    }
    return r.data;
  });

export const dashboardInventoryUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        handle: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(0).max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const health = await bffFetch<{ write_mode?: string }>("/api/dashboard/health");
    if (health.data?.write_mode !== "live_writes_allowed") {
      throw new Error(
        "Live zápisy sú vypnuté (BFF write_mode ≠ live_writes_allowed). Nastav DASHBOARD_ALLOW_LIVE_WRITES=1 na storefronte.",
      );
    }
    const r = await bffFetch<{
      ok: boolean;
      handle: string;
      quantity: number | null;
      available: boolean;
    }>("/api/dashboard/inventory", {
      method: "PUT",
      body: { handle: data.handle, quantity: data.quantity },
    });
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Aktualizácia inventára zlyhala.");
    }
    return r.data;
  });

export type DashboardOrderRow = {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  total: string;
  currency: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: string;
};

export type AgentAction = {
  tool: string;
  status: string;
  result?: Record<string, unknown>;
};

async function runAgentTool(
  command: string,
  tool: string,
): Promise<{ action: AgentAction; note?: string }> {
  const { bffFetch } = await import("./storefront-bff.server");
  const r = await bffFetch<{
    actions?: AgentAction[];
    reply?: string;
    error?: string;
  }>("/api/dashboard/agent", {
    method: "POST",
    body: { command, mode: "monitor" },
  });
  if (!r.ok || !r.data) {
    throw new Error(r.error ?? "Agent BFF zlyhal.");
  }
  const action = (r.data.actions ?? []).find((a) => a.tool === tool);
  if (!action || action.status !== "ok") {
    throw new Error(
      `Tool ${tool} nedostupné${r.data.reply ? `: ${r.data.reply.slice(0, 160)}` : "."}`,
    );
  }
  return { action };
}

export const dashboardOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(50).default(30),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const r = await bffFetch<{
      orders: DashboardOrderRow[];
      count: number;
      note?: string;
      admin?: string;
    }>("/api/dashboard/orders", {
      query: { limit: data.limit },
    });
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Nepodarilo sa načítať objednávky.");
    }
    return r.data;
  });

export const dashboardOrderAnomalies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { action } = await runAgentTool(
      "Ukáž zaseknuté a anomálne objednávky so zlyhanými platbami",
      "order_anomalies",
    );
    const result = action.result ?? {};
    return {
      stale_orders: (result.stale_orders as unknown[]) ?? [],
      failed_count: Number(result.failed_count ?? 0),
      checked: Number(result.checked ?? 0),
      stale_threshold_hours: Number(result.stale_threshold_hours ?? 48),
      note: typeof result.note === "string" ? result.note : null,
    };
  });

export const dashboardInventoryAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        threshold: z.number().int().min(0).max(1000).default(5),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { action } = await runAgentTool(
      `Skladové alerty a nízke zásoby (threshold ${data.threshold})`,
      "inventory_alerts",
    );
    const result = action.result ?? {};
    return {
      alerts: (result.alerts as unknown[]) ?? [],
      checked: Number(result.checked ?? 0),
      threshold: Number(result.threshold ?? data.threshold),
      note: typeof result.note === "string" ? result.note : null,
    };
  });

export type AgentMode = "assist" | "plan" | "monitor";

export type DashboardAgentResult = {
  conversation_id: string;
  reply: string;
  mode: AgentMode;
  actions: AgentAction[];
};

export type DashboardAuditEntry = {
  id: string;
  timestamp: string;
  tool: string;
  status: string;
  summary?: string;
  conversation_id?: string;
};

export const dashboardAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        command: z.string().trim().min(1).max(4000),
        conversation_id: z.string().max(128).optional(),
        mode: z.enum(["assist", "plan", "monitor"]).default("assist"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<DashboardAgentResult> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const r = await bffFetch<DashboardAgentResult>("/api/dashboard/agent", {
      method: "POST",
      body: {
        command: data.command,
        conversation_id: data.conversation_id,
        mode: data.mode,
      },
    });
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Agent request zlyhal.");
    }
    return {
      conversation_id: r.data.conversation_id,
      reply: r.data.reply,
      mode: r.data.mode ?? data.mode,
      actions: r.data.actions ?? [],
    };
  });

export const dashboardAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetch } = await import("./storefront-bff.server");
    const r = await bffFetch<{
      entries: DashboardAuditEntry[];
      limit: number;
      offset: number;
    }>("/api/dashboard/audit", {
      query: { limit: data.limit, offset: data.offset },
    });
    if (!r.ok || !r.data) {
      throw new Error(r.error ?? "Audit BFF zlyhal.");
    }
    return r.data;
  });

export const dashboardExportDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ exportId: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { bffFetchText } = await import("./storefront-bff.server");
    const id = encodeURIComponent(data.exportId);
    const r = await bffFetchText(`/api/dashboard/export/${id}`);
    if (!r.ok || r.data == null) {
      throw new Error(r.error ?? "Export nedostupný alebo expirovaný.");
    }
    return {
      content: r.data,
      filename: r.filename ?? `export-${data.exportId}.csv`,
    };
  });
