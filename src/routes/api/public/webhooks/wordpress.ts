import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const EventSchema = z.object({
  topic: z.string().min(3).max(64),
  timestamp: z.union([z.string(), z.number()]).optional(),
  site: z.string().max(255).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

const MAX_BODY = 512 * 1024;
const SKEW_MS = 5 * 60 * 1000;

export const Route = createFileRoute("/api/public/webhooks/wordpress")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WORDPRESS_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[wp-webhook] WORDPRESS_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 503 });
        }

        const raw = await request.text();
        if (raw.length > MAX_BODY) return new Response("Payload too large", { status: 413 });

        const { verifyWpSignature, applyWordPressEvent, relayToEndpoints } = await import(
          "@/lib/wp-sync.server"
        );

        const signature =
          request.headers.get("x-gm-signature") ?? request.headers.get("x-wp-signature");
        if (!verifyWpSignature(raw, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof EventSchema>;
        try {
          parsed = EventSchema.parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        if (parsed.timestamp !== undefined) {
          const ts = Number(parsed.timestamp);
          const ms = Number.isFinite(ts) ? (ts < 1e12 ? ts * 1000 : ts) : NaN;
          if (Number.isFinite(ms) && Math.abs(Date.now() - ms) > SKEW_MS) {
            return new Response("Stale timestamp", { status: 400 });
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();

        let status = "processed";
        let errorText: string | null = null;
        let relayed: string[] = [];

        try {
          await applyWordPressEvent(parsed.topic, parsed.data);
        } catch (e) {
          status = "failed";
          errorText = (e as Error).message.slice(0, 300);
          console.error("[wp-webhook] apply failed", { topic: parsed.topic, message: errorText });
        }

        try {
          relayed = await relayToEndpoints(parsed.topic, { topic: parsed.topic, data: parsed.data });
          if (status === "processed" && relayed.length > 0) status = "relayed";
        } catch (e) {
          console.error("[wp-webhook] relay failed", { message: (e as Error).message });
        }

        try {
          await supabaseAdmin.from("webhook_events").insert({
            source: "wordpress",
            topic: parsed.topic,
            payload: parsed.data as never,
            status,
            error: errorText,
            relayed_to: relayed,
          });
          await supabaseAdmin.from("integrations").upsert(
            {
              provider: "wordpress",
              name: "default",
              status: status === "failed" ? "error" : "connected",
              last_tested_at: nowIso,
              last_error: errorText,
            },
            { onConflict: "provider,name" },
          );
        } catch (e) {
          console.error("[wp-webhook] log write failed", { message: (e as Error).message });
        }

        return Response.json({ ok: status !== "failed", topic: parsed.topic, status, relayed: relayed.length });
      },
    },
  },
});