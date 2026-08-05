import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const verifyAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    const { email, uid } = assertAdmin(context.claims);
    const name =
      (context.claims as Record<string, unknown>).name ??
      (context.claims as Record<string, unknown>).full_name ??
      null;
    return { email, uid, name: typeof name === "string" ? name : null };
  });

/** Get current integrations list (status only, no secret values). */
export const listIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("integrations")
      .select("id, provider, name, status, is_active, last_tested_at, last_error, updated_at")
      .order("provider", { ascending: true });
    if (error) {
      console.error("[db:listIntegrations]", error);
      throw new Error("Nepodarilo sa načítať integrácie.");
    }
    return { integrations: rows ?? [] };
  });

const UpsertInput = z.object({
  provider: z.string().min(1).max(64),
  name: z.string().min(1).max(128).default("default"),
  config: z.record(z.string(), z.unknown()),
});

export const upsertIntegrationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("integrations").upsert(
      {
        provider: data.provider,
        name: data.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: data.config as any,
      },
      { onConflict: "provider,name" },
    );
    if (error) {
      console.error("[db:upsertIntegration]", error);
      throw new Error("Uloženie konfigurácie zlyhalo.");
    }
    return { ok: true };
  });

/** Recent webhook events (for Lovable Cloud card). */
export const listRecentWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("webhook_events")
      .select("id, source, topic, status, error, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("[db:listWebhookEvents]", error);
      throw new Error("Nepodarilo sa načítať webhook eventy.");
    }
    return { events: rows ?? [] };
  });
