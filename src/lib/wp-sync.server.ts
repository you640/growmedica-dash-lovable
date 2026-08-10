// Server-only helpers for the WordPress -> Supabase webhook relay.
// Never import this from client code.
import { createHmac, timingSafeEqual } from "crypto";

export type RelayTopic = string;

export function verifyWpSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const clean = signature.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(clean, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "rendered" in (v as Record<string, unknown>)) {
    const r = (v as { rendered?: unknown }).rendered;
    return typeof r === "string" ? r : null;
  }
  return null;
}

function plain(v: unknown): string | null {
  const s = str(v);
  return s === null
    ? null
    : s
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function iso(v: unknown): string | null {
  const s = typeof v === "string" ? v : null;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type Payload = Record<string, unknown>;

export type SyncOutcome = {
  table: string;
  action: "upsert" | "delete" | "skip";
  wpId: number | null;
};

const CONTENT_TYPE_BY_PREFIX: Record<string, string> = {
  post: "post",
  page: "page",
  media: "media",
  product: "product",
};

/**
 * Applies one webhook event to the mirror tables.
 * `topic` looks like "post.published", "order.status_changed", "plugin.activated".
 */
export async function applyWordPressEvent(topic: string, payload: Payload): Promise<SyncOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [entity, action = ""] = topic.split(".");
  const deleted = /deleted|trashed|removed/.test(action);
  const wpId = num(payload.id ?? payload.ID ?? payload.wp_id);

  if (entity && CONTENT_TYPE_BY_PREFIX[entity]) {
    const contentType = CONTENT_TYPE_BY_PREFIX[entity];
    if (wpId === null) return { table: "wp_content", action: "skip", wpId: null };

    if (deleted) {
      const { error } = await supabaseAdmin
        .from("wp_content")
        .update({ deleted_at: new Date().toISOString(), status: "deleted" })
        .eq("content_type", contentType)
        .eq("wp_id", wpId);
      if (error) throw new Error(error.message);
      return { table: "wp_content", action: "delete", wpId };
    }

    const row = {
      content_type: contentType,
      wp_id: wpId,
      title: plain(payload.title ?? payload.name),
      slug: typeof payload.slug === "string" ? payload.slug : null,
      status: typeof payload.status === "string" ? payload.status : null,
      link: typeof payload.link === "string" ? payload.link : (str(payload.permalink) ?? null),
      excerpt: plain(payload.excerpt ?? payload.short_description)?.slice(0, 500) ?? null,
      image_url:
        (typeof payload.image_url === "string" ? payload.image_url : null) ??
        (typeof payload.source_url === "string" ? payload.source_url : null) ??
        (typeof payload.featured_image === "string" ? payload.featured_image : null),
      alt_text: typeof payload.alt_text === "string" ? payload.alt_text : null,
      price: num(payload.price),
      stock_status: typeof payload.stock_status === "string" ? payload.stock_status : null,
      stock_quantity: num(payload.stock_quantity),
      author: typeof payload.author === "string" ? payload.author : null,
      wp_created_at: iso(payload.date ?? payload.date_created),
      wp_modified_at: iso(payload.modified ?? payload.date_modified) ?? new Date().toISOString(),
      raw: payload as never,
      deleted_at: null,
    };

    const { error } = await supabaseAdmin
      .from("wp_content")
      .upsert(row, { onConflict: "content_type,wp_id" });
    if (error) throw new Error(error.message);
    return { table: "wp_content", action: "upsert", wpId };
  }

  if (entity === "order") {
    if (wpId === null) return { table: "wc_orders", action: "skip", wpId: null };
    if (deleted) {
      const { error } = await supabaseAdmin
        .from("wc_orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("wp_id", wpId);
      if (error) throw new Error(error.message);
      return { table: "wc_orders", action: "delete", wpId };
    }
    const billing = (payload.billing ?? {}) as Record<string, unknown>;
    const items = Array.isArray(payload.line_items)
      ? payload.line_items.length
      : num(payload.item_count);
    const row = {
      wp_id: wpId,
      number: typeof payload.number === "string" ? payload.number : String(wpId),
      status: typeof payload.status === "string" ? payload.status : null,
      currency: typeof payload.currency === "string" ? payload.currency : null,
      total: num(payload.total),
      customer_email:
        (typeof billing.email === "string" ? billing.email : null) ??
        (typeof payload.customer_email === "string" ? payload.customer_email : null),
      customer_name:
        [billing.first_name, billing.last_name]
          .filter((p): p is string => typeof p === "string" && !!p)
          .join(" ") || (typeof payload.customer_name === "string" ? payload.customer_name : null),
      customer_wp_id: num(payload.customer_id),
      item_count: items,
      payment_method:
        typeof payload.payment_method_title === "string"
          ? payload.payment_method_title
          : typeof payload.payment_method === "string"
            ? payload.payment_method
            : null,
      wp_created_at: iso(payload.date_created ?? payload.date),
      wp_modified_at: iso(payload.date_modified) ?? new Date().toISOString(),
      raw: payload as never,
      deleted_at: null,
    };
    const { error } = await supabaseAdmin.from("wc_orders").upsert(row, { onConflict: "wp_id" });
    if (error) throw new Error(error.message);
    return { table: "wc_orders", action: "upsert", wpId };
  }

  if (entity === "customer") {
    if (wpId === null) return { table: "wc_customers", action: "skip", wpId: null };
    if (deleted) {
      const { error } = await supabaseAdmin
        .from("wc_customers")
        .update({ deleted_at: new Date().toISOString() })
        .eq("wp_id", wpId);
      if (error) throw new Error(error.message);
      return { table: "wc_customers", action: "delete", wpId };
    }
    const billing = (payload.billing ?? {}) as Record<string, unknown>;
    const row = {
      wp_id: wpId,
      email:
        (typeof payload.email === "string" ? payload.email : null) ??
        (typeof billing.email === "string" ? billing.email : null),
      first_name:
        (typeof payload.first_name === "string" ? payload.first_name : null) ??
        (typeof billing.first_name === "string" ? billing.first_name : null),
      last_name:
        (typeof payload.last_name === "string" ? payload.last_name : null) ??
        (typeof billing.last_name === "string" ? billing.last_name : null),
      username: typeof payload.username === "string" ? payload.username : null,
      orders_count: num(payload.orders_count),
      total_spent: num(payload.total_spent),
      wp_created_at: iso(payload.date_created),
      raw: payload as never,
      deleted_at: null,
    };
    const { error } = await supabaseAdmin.from("wc_customers").upsert(row, { onConflict: "wp_id" });
    if (error) throw new Error(error.message);
    return { table: "wc_customers", action: "upsert", wpId };
  }

  if (entity === "plugin") {
    const slug =
      (typeof payload.plugin === "string" ? payload.plugin : null) ??
      (typeof payload.slug === "string" ? payload.slug : null);
    if (!slug) return { table: "wp_plugins", action: "skip", wpId: null };
    const row = {
      plugin_slug: slug,
      name: typeof payload.name === "string" ? payload.name : slug,
      version: typeof payload.version === "string" ? payload.version : null,
      is_active:
        action === "activated"
          ? true
          : action === "deactivated"
            ? false
            : payload.is_active === true,
      update_available:
        typeof payload.update_available === "string" ? payload.update_available : null,
      last_synced_at: new Date().toISOString(),
      raw: payload as never,
    };
    const { error } = await supabaseAdmin
      .from("wp_plugins")
      .upsert(row, { onConflict: "plugin_slug" });
    if (error) throw new Error(error.message);
    return { table: "wp_plugins", action: "upsert", wpId: null };
  }

  return { table: "-", action: "skip", wpId };
}

/** Fan-out the verified event to active webhook_endpoints subscribed to the topic. */
export async function relayToEndpoints(topic: string, body: unknown): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: endpoints, error } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, target_url, events, is_active")
    .eq("is_active", true);
  if (error || !endpoints?.length) return [];

  const targets = endpoints.filter(
    (e) => Array.isArray(e.events) && (e.events.includes(topic) || e.events.includes("*")),
  );

  const delivered: string[] = [];
  await Promise.all(
    targets.map(async (e) => {
      try {
        const res = await fetch(e.target_url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-GM-Topic": topic },
          body: JSON.stringify(body),
        });
        if (res.ok) delivered.push(e.id);
        else console.error(`[wp-relay] endpoint ${e.id} responded ${res.status}`);
      } catch (err) {
        console.error("[wp-relay] endpoint delivery failed", {
          id: e.id,
          message: (err as Error).message,
        });
      }
    }),
  );
  return delivered;
}
