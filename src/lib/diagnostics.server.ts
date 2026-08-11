export type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  ms: number;
  detail?: string;
  hint?: string;
};

export type EnvResult = {
  key: string;
  present: boolean;
  length: number;
  hint?: string;
};

const REQUIRED_ENV = [
  "ADMIN_EMAILS",
  "STOREFRONT_BFF_BASE_URL",
  "DASHBOARD_AGENT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const ENV_HINTS: Record<string, string> = {
  ADMIN_EMAILS:
    "Chýba zoznam admin e-mailov. Pridaj secret ADMIN_EMAILS ako čiarkou oddelené adresy (bez medzier navyše) a znovu spusti test.",
  STOREFRONT_BFF_BASE_URL:
    "Chýba základná URL storefrontu (napr. https://www.growmedica.cz, bez lomky na konci). Pridaj secret STOREFRONT_BFF_BASE_URL.",
  DASHBOARD_AGENT_SECRET:
    "Chýba zdieľaný kľúč pre server-to-server volania. Vygeneruj jeden silný náhodný string, ulož ho ako secret DASHBOARD_AGENT_SECRET tu aj v prostredí storefrontu (Vercel) a storefront redeployni.",
  SUPABASE_URL: "Chýba URL backendu. Skontroluj, či je Lovable Cloud zapnutý pre tento projekt.",
  SUPABASE_SERVICE_ROLE_KEY:
    "Chýba servisný kľúč backendu. Skontroluj, či je Lovable Cloud zapnutý; kľúč sa dopĺňa automaticky.",
};

/** Canonical storefront BFF auth header (parity with storefront/src/lib/dashboard-agent/auth.ts). */
const SECRET_HEADER = "x-dashboard-agent-secret";

function hintForCheck(
  name: string,
  status: number | undefined,
  detail?: string,
): string | undefined {
  if (name.startsWith("unauth")) {
    return "Endpoint bez kľúča nesmie vrátiť 2xx. Na storefronte doplň kontrolu hlavičky x-dashboard-agent-secret a vracaj 401 pri chýbajúcom/nesprávnom kľúči.";
  }
  switch (status) {
    case 401:
    case 403:
      return "Kľúč nesedí. DASHBOARD_AGENT_SECRET tu a na storefronte (Vercel → Environment Variables) musí byť znak po znaku rovnaký — pozor na medzery a nový riadok pri kopírovaní. Po zmene sprav redeploy storefrontu.";
    case 404:
      return "Endpoint neexistuje na tejto doméne. Skontroluj STOREFRONT_BFF_BASE_URL (bez /api a bez lomky na konci) a či je route /api/dashboard/* nasadená.";
    case 405:
      return "Metóda nie je povolená — endpoint musí podporovať GET.";
    case 429:
      return "Rate limit na storefronte. Zopakuj test o chvíľu, prípadne pridaj výnimku pre server-to-server volania.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Chyba na strane storefrontu. Pozri logy nasadenia na Verceli pre tento endpoint.";
    default:
      break;
  }
  if (status === 200 && name === "health" && detail && !detail.includes("cms_provider")) {
    return "Health odpovedá, ale nevracia cms_provider — storefront pravdepodobne neautentifikoval volanie. Zjednoť DASHBOARD_AGENT_SECRET na oboch stranách.";
  }
  if (!status) {
    return "Volanie vôbec neprešlo (sieť/DNS/TLS). Over, že STOREFRONT_BFF_BASE_URL je verejne dostupná https adresa.";
  }
  return undefined;
}

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
      Accept: "application/json",
      ...(secret ? { [SECRET_HEADER]: secret } : {}),
    },
  });
  const text = await res.text();
  let detail = `${path} · ${text.slice(0, 200)}`;
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    detail = `${path} · ${JSON.stringify(json).slice(0, 200)}`;
  } catch {
    /* keep raw snippet with path */
  }
  return { ok: res.ok, status: res.status, detail };
}

export async function runSmokeTest() {
  const startedAt = new Date().toISOString();
  const env: EnvResult[] = REQUIRED_ENV.map((key) => {
    const v = process.env[key];
    const present = Boolean(v && v.length > 0);
    return {
      key,
      present,
      length: v ? v.length : 0,
      ...(present ? {} : { hint: ENV_HINTS[key] }),
    };
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
      hint: ENV_HINTS["STOREFRONT_BFF_BASE_URL"],
    });
  } else {
    const base = trimBase(baseRaw);

    // health: soft-public without secret returns {ok:true}; auth success needs cms_provider
    checks.push(
      await timed("health", async () => {
        const r = await callBff(base, "/api/dashboard/health", secret);
        const hasCms = Boolean(r.detail && r.detail.includes("cms_provider"));
        return {
          ok: r.status === 200 && hasCms,
          status: r.status,
          detail: r.detail,
        };
      }),
    );

    checks.push(await timed("overview", () => callBff(base, "/api/dashboard/overview", secret)));
    checks.push(
      await timed("products", () => callBff(base, "/api/dashboard/products?limit=3", secret)),
    );
    checks.push(
      await timed("orders", () => callBff(base, "/api/dashboard/orders?limit=3", secret)),
    );
    checks.push(
      await timed("unauth (must be 401/403)", async () => {
        const r = await callBff(base, "/api/dashboard/products?limit=1", undefined);
        return { ok: r.status === 401 || r.status === 403, status: r.status, detail: r.detail };
      }),
    );
  }

  for (const c of checks) {
    if (!c.ok && !c.hint) {
      c.hint = hintForCheck(c.name, c.status, c.detail);
    }
    if (c.ok && c.name === "health") {
      const h = hintForCheck(c.name, c.status, c.detail);
      if (h) c.hint = h;
    }
  }

  const envOk = env.every((e) => e.present);
  const checksOk = checks.every((c) => c.ok);
  const passed = checks.filter((c) => c.ok).length;

  const remediation = [
    ...env.filter((e) => !e.present && e.hint).map((e) => `${e.key}: ${e.hint!}`),
    ...checks.filter((c) => c.hint).map((c) => `${c.name}: ${c.hint!}`),
  ];

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: envOk && checksOk,
    summary: `env ${env.filter((e) => e.present).length}/${env.length} · testy ${passed}/${checks.length}`,
    env,
    checks,
    remediation,
  };
}
