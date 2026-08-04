import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WordPressTestResult = {
  ok: boolean;
  connected: boolean;
  siteUrl: string | null;
  siteName: string | null;
  user: string | null;
  isSuperAdmin: boolean;
  restNamespaces: string[];
  counts: { posts: number | null; pages: number | null; media: number | null };
  wooDetected: boolean;
  error: string | null;
};

export const testWordPressConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WordPressTestResult> => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { wpFetch, hasWordPressConnection } = await import("./wordpress-client.server");

    const base: WordPressTestResult = {
      ok: false,
      connected: false,
      siteUrl: null,
      siteName: null,
      user: null,
      isSuperAdmin: false,
      restNamespaces: [],
      counts: { posts: null, pages: null, media: null },
      wooDetected: false,
      error: null,
    };

    if (!hasWordPressConnection()) {
      return { ...base, error: "WordPress konektor nie je pripojený k projektu." };
    }

    let result: WordPressTestResult = { ...base, connected: true };
    try {
      const me = await wpFetch<{
        name?: string;
        url?: string;
        is_super_admin?: boolean;
        woocommerce_meta?: unknown;
      }>("/users/me");

      if (!me.ok) {
        result = {
          ...result,
          error: `WordPress REST API vrátilo HTTP ${me.status}. Skontrolujte Application Password a pretty permalinks.`,
        };
      } else {
        const [posts, pages, media, root] = await Promise.all([
          wpFetch("/posts", { query: { per_page: 1 } }),
          wpFetch("/pages", { query: { per_page: 1 } }),
          wpFetch("/media", { query: { per_page: 1 } }),
          wpFetch<{ namespaces?: string[]; name?: string }>("/"),
        ]);
        const namespaces = Array.isArray(root.json?.namespaces) ? root.json!.namespaces! : [];
        result = {
          ...result,
          ok: true,
          siteUrl: typeof me.json?.url === "string" ? me.json.url : null,
          siteName: typeof root.json?.name === "string" ? root.json.name : null,
          user: typeof me.json?.name === "string" ? me.json.name : null,
          isSuperAdmin: me.json?.is_super_admin === true,
          restNamespaces: namespaces,
          counts: {
            posts: posts.totalItems,
            pages: pages.totalItems,
            media: media.totalItems,
          },
          wooDetected:
            !!me.json?.woocommerce_meta || namespaces.some((n) => n.startsWith("wc/")),
          error: null,
        };
      }
    } catch (e) {
      console.error("[wordpress:test]", { message: (e as Error).message });
      result = { ...result, error: "Sieťová alebo runtime chyba pri WordPress REST API." };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("integrations").upsert(
        {
          provider: "wordpress",
          name: "default",
          status: result.ok ? "connected" : "error",
          last_tested_at: new Date().toISOString(),
          last_error: result.ok ? null : result.error,
        },
        { onConflict: "provider,name" },
      );
    } catch (e) {
      console.error("[wordpress:test:status-write]", { message: (e as Error).message });
    }

    return result;
  });

export type WpPost = {
  id: number;
  title: string;
  excerpt: string;
  status: string;
  link: string;
  date: string;
};

export const listWordPressPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        perPage: z.number().int().min(1).max(50).default(10),
        page: z.number().int().min(1).max(500).default(1),
        search: z.string().trim().max(120).optional(),
        status: z.enum(["publish", "draft", "any"]).default("publish"),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./admin-guard.server");
    assertAdmin(context.claims);
    const { wpFetch, stripHtml } = await import("./wordpress-client.server");

    const query: Record<string, string | number> = {
      per_page: data.perPage,
      page: data.page,
      status: data.status,
    };
    if (data.search) query.search = data.search;

    const r = await wpFetch<
      Array<{
        id: number;
        title?: { rendered?: string };
        excerpt?: { rendered?: string };
        status?: string;
        link?: string;
        date?: string;
      }>
    >("/posts", { query });

    if (!r.ok || !Array.isArray(r.json)) {
      return { posts: [] as WpPost[], total: 0, totalPages: 0, error: `HTTP ${r.status}` };
    }

    const posts: WpPost[] = r.json.map((p) => ({
      id: p.id,
      title: stripHtml(p.title?.rendered ?? "(bez názvu)"),
      excerpt: stripHtml(p.excerpt?.rendered ?? "").slice(0, 180),
      status: p.status ?? "unknown",
      link: p.link ?? "",
      date: p.date ?? "",
    }));

    return {
      posts,
      total: r.totalItems ?? posts.length,
      totalPages: r.totalPages ?? 1,
      error: null as string | null,
    };
  });