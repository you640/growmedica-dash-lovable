export type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  ms: number;
  detail?: string;
};

const REQUIRED_ENV = [
  "ADMIN_EMAILS",
  "STOREFRONT_BFF_BASE_URL",
  "DASHBOARD_AGENT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function trimBase(url: string) {
  return url.replace(/\/+$/, "");
}

async function timed(
  name: string,
  run: () => Promise<{ ok: boolean; status?: number; detail?: string }>,
): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const r = await run();
    return { name, ...r, ms: Date.now() - t0 };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t0, detail: (e as Error).message };
  }
}

async function callBff(
  base: string,
  path: string,
  secret: string | undefined,
): Promise<{ ok: boolean; status: number; detail?: string }> {
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(secret ? { "x-agent-secret": secret, authorization: `Bearer ${secret}` } : {}),
    },
  });
  const text = await res.text();
  let detail = text.slice(0, 200);
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    detail = JSON.stringify(json).slice(0, 200);
  } catch {
    /* keep raw snippet */
  }
  return { ok: res.ok, status: res.status, detail };
}

export async function runSmokeTest() {
  const startedAt = new Date().toISOString();
  const env = REQUIRED_ENV.map((key) => {
    const v = process.env[key];
    return { key, present: Boolean(v && v.length > 0), length: v ? v.length : 0 };
  });

  const baseRaw = process.env.STOREFRONT_BFF_BASE_URL;
  const secret = process.env.DASHBOARD_AGENT_SECRET;
  const checks: CheckResult[] = [];

  if (!baseRaw) {
    checks.push({
      name: "bff:config",
      ok: false,
      ms: 0,
      detail: "Chýba STOREFRONT_BFF_BASE_URL.",
    });
  } else {
    const base = trimBase(baseRaw);
    checks.push(await timed("health", () => callBff(base, "/api/agent/health", secret)));
    checks.push(await timed("overview", () => callBff(base, "/api/agent/overview", secret)));
    checks.push(await timed("products", () => callBff(base, "/api/agent/products?limit=1", secret)));
    checks.push(await timed("orders", () => callBff(base, "/api/agent/orders?limit=1", secret)));
    checks.push(
      await timed("unauth (must be 401/403)", async () => {
        const r = await callBff(base, "/api/agent/overview", undefined);
        return { ok: r.status === 401 || r.status === 403, status: r.status, detail: r.detail };
      }),
    );
  }

  const envOk = env.every((e) => e.present);
  const checksOk = checks.every((c) => c.ok);
  const passed = checks.filter((c) => c.ok).length;

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: envOk && checksOk,
    summary: `env ${env.filter((e) => e.present).length}/${env.length} · testy ${passed}/${checks.length}`,
    env,
    checks,
  };
}
