import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SyncStatus = {
  secretConfigured: boolean;
  connectorConnected: boolean;
  counts: {
    post: number;
    page: number;
    media: number;
    product: number;
    order: number;
    customer: number;
    plugin: number;
  };
  lastEventAt: string | null;
};

export const getWpSyncStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncStatus> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hasWordPressConnection } = await import("./wordpress-client.server");

    const countContent = async (type: string) => {
      const { count } = await supabaseAdmin
        .from("wp_content")
        .select("id", { count: "exact", head: true })
        .eq("content_type", type)
        .is("deleted_at", null);
      return count ?? 0;
    };
    const countOrders = async () => {
      const { count } = await supabaseAdmin
        .from("wc_orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      return count ?? 0;
    };
    const countCustomers = async () => {
      const { count } = await supabaseAdmin
        .from("wc_customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      return count ?? 0;
    };
    const countPlugins = async () => {
      const { count } = await supabaseAdmin
        .from("wp_plugins")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    };

    const [post, page, media, product, order, customer, plugin] = await Promise.all([
      countContent("post"),
      countContent("page"),
      countContent("media"),
      countContent("product"),
      countOrders(),
      countCustomers(),
      countPlugins(),
    ]);

    const { data: last } = await supabaseAdmin
      .from("webhook_events")
      .select("created_at")
      .eq("source", "wordpress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      secretConfigured: !!process.env["WORDPRESS_WEBHOOK_SECRET"]?.trim(),
      connectorConnected: hasWordPressConnection(),
      counts: { post, page, media, product, order, customer, plugin },
      lastEventAt: last?.created_at ?? null,
    };
  });

const ContentInput = z.object({
  contentType: z.enum(["post", "page", "media", "product"]),
  limit: z.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
});

export const listSyncedContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ContentInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("wp_content")
      .select(
        "id, wp_id, title, slug, status, link, image_url, price, stock_status, stock_quantity, wp_modified_at",
      )
      .eq("content_type", data.contentType)
      .is("deleted_at", null)
      .order("wp_modified_at", { ascending: false })
      .limit(data.limit);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[db:listSyncedContent]", { message: error.message });
      throw new Error("Nepodarilo sa načítať obsah.");
    }
    return { rows: rows ?? [] };
  });

const ListInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  status: z.string().trim().max(40).optional(),
  search: z.string().trim().max(120).optional(),
});

export const listSyncedOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("wc_orders")
      .select(
        "id, wp_id, number, status, currency, total, customer_email, customer_name, item_count, wp_created_at",
      )
      .is("deleted_at", null)
      .order("wp_created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) q = q.ilike("customer_email", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[db:listSyncedOrders]", { message: error.message });
      throw new Error("Nepodarilo sa načítať objednávky.");
    }
    return { rows: rows ?? [] };
  });

export const listSyncedCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("wc_customers")
      .select("id, wp_id, email, first_name, last_name, orders_count, total_spent, wp_created_at")
      .is("deleted_at", null)
      .order("wp_created_at", { ascending: false })
      .limit(data.limit);
    if (data.search) q = q.ilike("email", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[db:listSyncedCustomers]", { message: error.message });
      throw new Error("Nepodarilo sa načítať zákazníkov.");
    }
    return { rows: rows ?? [] };
  });

/** Pull current posts/pages/media/plugins from WordPress into the mirror tables. */
export const backfillWordPressContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { wpFetch, hasWordPressConnection } = await import("./wordpress-client.server");
    const { applyWordPressEvent } = await import("./wp-sync.server");

    if (!hasWordPressConnection()) {
      return { ok: false, imported: 0, error: "WordPress konektor nie je pripojený." };
    }

    const jobs: Array<{ path: string; topic: string }> = [
      { path: "/posts", topic: "post.updated" },
      { path: "/pages", topic: "page.updated" },
      { path: "/media", topic: "media.updated" },
    ];

    let imported = 0;
    let error: string | null = null;

    for (const job of jobs) {
      try {
        for (let page = 1; page <= 5; page++) {
          const r = await wpFetch<Array<Record<string, unknown>>>(job.path, {
            query: { per_page: 100, page, status: job.path === "/media" ? "inherit" : "any" },
          });
          if (!r.ok || !Array.isArray(r.json) || r.json.length === 0) break;
          for (const item of r.json) {
            await applyWordPressEvent(job.topic, item);
            imported++;
          }
          if (r.json.length < 100) break;
        }
      } catch (e) {
        error = "Import časti obsahu zlyhal.";
        console.error("[wp:backfill]", { path: job.path, message: (e as Error).message });
      }
    }

    try {
      const r = await wpFetch<Array<Record<string, unknown>>>("/plugins", {
        query: { per_page: 100 },
      });
      if (r.ok && Array.isArray(r.json)) {
        for (const p of r.json) {
          await applyWordPressEvent("plugin.updated", {
            plugin: p.plugin ?? p.textdomain,
            name: p.name,
            version: p.version,
            is_active: p.status === "active",
          });
          imported++;
        }
      }
    } catch (e) {
      console.error("[wp:backfill:plugins]", { message: (e as Error).message });
    }

    return { ok: error === null, imported, error };
  });
