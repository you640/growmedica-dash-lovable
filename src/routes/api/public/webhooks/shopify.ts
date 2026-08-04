import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(secret: string, body: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return new Uint8Array(sig);
}

export const Route = createFileRoute("/api/public/webhooks/shopify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
        const topic = request.headers.get("x-shopify-topic") ?? "unknown";
        const shop = request.headers.get("x-shopify-shop-domain") ?? "unknown";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Load webhook secret (env or DB config)
        let secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
        if (!secret) {
          const { data } = await supabaseAdmin
            .from("integrations")
            .select("config")
            .eq("provider", "shopify")
            .eq("name", "default")
            .maybeSingle();
          const cfg = (data?.config ?? {}) as { webhook_secret?: string };
          secret = cfg.webhook_secret ?? "";
        }

        if (!secret || !hmacHeader) {
          return new Response("Misconfigured", { status: 401 });
        }

        const expected = await hmacSha256(secret, body);
        const provided = fromBase64(hmacHeader);
        if (!timingSafeEqual(expected, provided)) {
          await supabaseAdmin.from("webhook_events").insert({
            source: `shopify:${shop}`,
            topic,
            payload: null,
            status: "failed",
            error: "Invalid HMAC",
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Json = null;
        try {
          payload = JSON.parse(body) as Json;
        } catch {
          payload = { raw: body.slice(0, 1000) };
        }

        await supabaseAdmin.from("webhook_events").insert({
          source: `shopify:${shop}`,
          topic,
          payload,
          status: "received",
        });

        // Fan-out relay is implemented in Phase 2.
        return new Response("ok", { status: 200 });
      },
    },
  },
});

// suppress unused export for client bundle
export const _hex = toHex;
