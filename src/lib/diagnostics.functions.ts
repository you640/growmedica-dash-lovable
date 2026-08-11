import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Spustí kompletný server-side smoke test (env, health, overview, products, orders, unauth). */
export const runDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { runSmokeTest } = await import("./diagnostics.server");
    return runSmokeTest();
  });
