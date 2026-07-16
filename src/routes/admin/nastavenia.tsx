import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import {
  listIntegrations,
  upsertIntegrationConfig,
  listRecentWebhookEvents,
} from "@/lib/admin.functions";
import { testShopifyConnection, getShopifyAuthStatus } from "@/lib/shopify.functions";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Plug,
  Database,
  Cloud,
  Flame,
  Sparkles,
  Server,
  Globe,
  Webhook,
  Copy,
} from "lucide-react";

export const Route = createFileRoute("/admin/nastavenia")({
  component: SettingsPage,
});

const PROVIDERS = [
  { id: "shopify", label: "Shopify", icon: Plug },
  { id: "lovable_cloud", label: "Lovable Cloud", icon: Database },
  { id: "vercel", label: "Vercel", icon: Cloud },
  { id: "firebase", label: "Firebase", icon: Flame },
  { id: "mistral_ai", label: "Mistral AI", icon: Sparkles },
  { id: "gcp", label: "Google Cloud", icon: Server },
  { id: "wordpress", label: "WordPress", icon: Globe },
  { id: "custom", label: "Custom Webhook", icon: Webhook },
] as const;

type Tab = (typeof PROVIDERS)[number]["id"];

type IntegrationRow = {
  provider: string;
  status: string;
  last_error: string | null;
  last_tested_at: string | null;
};

function StatusDot({ status }: { status?: string | null }) {
  const color =
    status === "connected"
      ? "bg-green-500"
      : status === "error"
        ? "bg-red-500"
        : status === "testing"
          ? "bg-yellow-500"
          : "bg-gray-300";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("shopify");
  const listFn = useServerFn(listIntegrations);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);

  async function refresh() {
    const r = await listFn();
    setIntegrations(r.integrations as IntegrationRow[]);
  }
  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusFor = (id: string) =>
    integrations.find((i) => i.provider === id)?.status ?? "disconnected";

  return (
    <div>
      <SectionHeading
        title="Integration Hub"
        subtitle="Pripojte Shopify, Lovable Cloud, Vercel, Firebase, Mistral, GCP, WordPress a vlastné webhooky. Všetky secrets sú v UI maskované a uložené v Cloude."
      />

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        <GlassPanel className="p-2 h-fit">
          {PROVIDERS.map((p) => {
            const Icon = p.icon;
            const active = tab === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setTab(p.id)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-sm transition ${
                  active
                    ? "bg-[var(--gm-primary)]/10 text-gm-text"
                    : "text-gm-text-muted hover:bg-gm-bg-soft hover:text-gm-text"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {p.label}
                </span>
                <StatusDot status={statusFor(p.id)} />
              </button>
            );
          })}
        </GlassPanel>

        <div>
          {tab === "shopify" && <ShopifyCard onSaved={refresh} />}
          {tab === "lovable_cloud" && <LovableCloudCard />}
          {tab !== "shopify" && tab !== "lovable_cloud" && (
            <GenericConfigCard providerId={tab} onSaved={refresh} />
          )}
        </div>
      </div>
    </div>
  );
}

function ShopifyCard({ onSaved }: { onSaved: () => void }) {
  const upsert = useServerFn(upsertIntegrationConfig);
  const test = useServerFn(testShopifyConnection);
  const authStatusFn = useServerFn(getShopifyAuthStatus);

  const [form, setForm] = useState({
    store_domain: "",
    api_version: "2026-07",
    storefront_token: "",
    webhook_secret: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  type TestResult = Awaited<ReturnType<typeof test>>;
  const [result, setResult] = useState<TestResult | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  type AuthStatus = Awaited<ReturnType<typeof authStatusFn>>;
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    authStatusFn()
      .then((s) => setAuthStatus(s))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const config: Record<string, string> = { api_version: form.api_version };
      for (const k of ["store_domain", "storefront_token", "webhook_secret"] as const) {
        if (form[k]) config[k] = form[k];
      }
      await upsert({
        data: { provider: "shopify", name: "default", config },
      });
      setSavedMsg("Uložené.");
      toast.success("Konfigurácia Shopify uložená.");
      onSaved();
      authStatusFn()
        .then(setAuthStatus)
        .catch(() => undefined);
    } catch (e) {
      setSavedMsg(`Chyba: ${(e as Error).message}`);
      toast.error(`Chyba: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setResult(null);
    try {
      const r = await test();
      setResult(r);
      if (r.ok) {
        toast.success(`Pripojené: ${r.shopName ?? r.myshopifyDomain ?? "OK"}`);
      } else {
        toast.error(r.error ?? "Test pripojenia zlyhal.");
      }
      onSaved();
    } catch (e) {
      setResult({
        ok: false,
        domain: null,
        apiVersion: form.api_version,
        apiVersionHeader: null,
        versionOk: false,
        shopName: null,
        myshopifyDomain: null,
        scopes: [],
        missingScopes: ["read_products", "write_products", "read_inventory", "write_inventory"],
        authMode: "none",
        error: (e as Error).message,
      } as TestResult);
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app";

  return (
    <GlassPanel className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Shopify</h2>
        <p className="text-sm text-gm-text-muted mt-1">
          Admin API 2026-07 cez server-side client credentials. Client ID a client secret sa
          nastavujú výlučne ako Lovable Cloud secrets — v UI ich nikdy neukladáme ani nezobrazujeme.
          Storefront token je voliteľný.
        </p>
      </div>

      {authStatus && (
        <div className="rounded-md border border-gm-border bg-white/60 p-4 text-sm space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <StatusLine
              label="SHOPIFY_CLIENT_ID"
              ok={authStatus.hasClientId}
              okText="Configured"
              badText="Missing"
            />
            <StatusLine
              label="SHOPIFY_CLIENT_SECRET"
              ok={authStatus.hasClientSecret}
              okText="Configured"
              badText="Missing"
            />
            <StatusLine
              label="Store domain"
              ok={!!authStatus.domain}
              okText={authStatus.domain ?? ""}
              badText="Neplatný / chýba"
            />
            <StatusLine
              label="API verzia"
              ok={authStatus.apiVersion === authStatus.requiredApiVersion}
              okText={authStatus.apiVersion}
              badText={`${authStatus.apiVersion} (očak. ${authStatus.requiredApiVersion})`}
            />
          </div>
          <div className="text-xs text-gm-text-muted">
            Auth mode: <span className="font-mono">{authStatus.authMode}</span>
            {authStatus.authMode === "partial" && (
              <span className="ml-2 text-red-600">
                Nastavené je iba jedno z ID/secret — fail closed.
              </span>
            )}
            {authStatus.authMode === "legacy_admin_token" && (
              <span className="ml-2 text-amber-700">
                Používa sa deprecated SHOPIFY_ADMIN_ACCESS_TOKEN fallback.
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Store domain"
          placeholder="moj-shop.myshopify.com"
          value={form.store_domain}
          onChange={(v) => setForm({ ...form, store_domain: v })}
        />
        <Field
          label="API verzia (očakávané 2026-07)"
          value={form.api_version}
          onChange={(v) => setForm({ ...form, api_version: v })}
        />
        <Field
          label="Storefront access token (voliteľné)"
          placeholder="shpat_…"
          secret
          value={form.storefront_token}
          onChange={(v) => setForm({ ...form, storefront_token: v })}
        />
        <Field
          label="Webhook secret"
          secret
          value={form.webhook_secret}
          onChange={(v) => setForm({ ...form, webhook_secret: v })}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-gm-primary text-white px-5 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Ukladám…" : "Uložiť konfiguráciu"}
        </button>
        <button
          onClick={runTest}
          disabled={testing}
          className="rounded-full border border-gm-border bg-white px-5 py-2 text-sm hover:bg-gm-bg-soft disabled:opacity-50 inline-flex items-center gap-2"
        >
          {testing && <Loader2 className="w-4 h-4 animate-spin" />}
          Test pripojenia
        </button>
        {savedMsg && <span className="text-sm text-gm-text-muted self-center">{savedMsg}</span>}
      </div>

      {result && (
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <ResultRow
            label={`Admin API (${result.authMode})`}
            ok={result.ok}
            detail={
              result.ok
                ? `Shop: ${result.shopName ?? "?"} (${result.myshopifyDomain ?? "?"})`
                : (result.error ?? "Neznáma chyba")
            }
          />
          <ResultRow
            label={`API verzia (${result.apiVersion})`}
            ok={result.versionOk}
            detail={
              result.versionOk
                ? `X-Shopify-API-Version: ${result.apiVersionHeader}`
                : `Header: ${result.apiVersionHeader ?? "chýba"}`
            }
          />
          <ResultRow
            label="Required scopes"
            ok={result.missingScopes.length === 0}
            detail={
              result.missingScopes.length === 0
                ? result.scopes.join(", ") || "(žiadne)"
                : `Chýbajú: ${result.missingScopes.join(", ")}`
            }
          />
        </div>
      )}

      <div className="border-t border-gm-border pt-4">
        <div className="text-sm font-medium">Webhook URL pre Shopify Admin</div>
        <p className="text-xs text-gm-text-muted mt-1">
          Skopírujte túto URL do <i>Settings → Notifications → Webhooks</i> v Shopify. Topics:
          products/*, orders/*, customers/*, inventory_levels/update, collections/*.
        </p>
        <CopyRow value={`${origin}/api/public/webhooks/shopify`} />
      </div>
    </GlassPanel>
  );
}

function LovableCloudCard() {
  const fn = useServerFn(listRecentWebhookEvents);
  type EventRow = {
    id: string;
    source: string;
    topic: string;
    status: string;
    error: string | null;
    created_at: string;
  };
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fn();
        setEvents(r.events as EventRow[]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlassPanel className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Lovable Cloud</h2>
        <p className="text-sm text-gm-text-muted mt-1">
          Postgres + edge runtime sú zapnuté automaticky. Tabuľky: integrations, webhook_endpoints,
          webhook_events, sync_jobs, shopify_product_cache.
        </p>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Posledné webhook eventy</div>
        {loading ? (
          <div className="text-sm text-gm-text-muted">Načítavam…</div>
        ) : events.length === 0 ? (
          <div className="text-sm text-gm-text-muted">
            Zatiaľ žiadne. Po nakonfigurovaní Shopify webhooku sa tu objavia.
          </div>
        ) : (
          <div className="overflow-auto rounded-md border border-gm-border">
            <table className="w-full text-xs">
              <thead className="bg-gm-bg-soft text-gm-text-muted">
                <tr>
                  <th className="text-left px-3 py-2">Čas</th>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-left px-3 py-2">Topic</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-gm-border">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("sk-SK")}
                    </td>
                    <td className="px-3 py-2">{e.source}</td>
                    <td className="px-3 py-2 font-mono">{e.topic}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          e.status === "failed"
                            ? "text-red-600"
                            : e.status === "relayed"
                              ? "text-green-600"
                              : "text-gm-text-muted"
                        }
                      >
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

type FieldSpec = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  textarea?: boolean;
};

const PROVIDER_SCHEMAS: Record<
  string,
  { label: string; description: string; fields: FieldSpec[] }
> = {
  vercel: {
    label: "Vercel",
    description:
      "Deploy hooks a project metadata. Použité pre rebuild po AI optimalizácii produktov.",
    fields: [
      { key: "project_id", label: "Project ID", placeholder: "prj_…" },
      { key: "team_id", label: "Team ID (voliteľné)", placeholder: "team_…" },
      { key: "api_token", label: "API token", secret: true, placeholder: "vrcl_…" },
      { key: "deploy_hook_url", label: "Deploy hook URL", secret: true },
    ],
  },
  firebase: {
    label: "Firebase",
    description:
      "Firebase config je v Lovable Cloud secretoch (FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID, ADMIN_EMAILS). Tu nastavte voliteľný override.",
    fields: [
      { key: "auth_domain_override", label: "Auth domain override" },
      {
        key: "admin_emails_extra",
        label: "Ďalšie admin e-maily (čiarkou oddelené)",
        placeholder: "user@example.com, second@example.com",
      },
    ],
  },
  mistral_ai: {
    label: "Mistral AI",
    description:
      "Mistral je primárny LLM pre celú platformu (SEO rewrite, agentic akcie, analytiku). API kľúč si nastavte ako MISTRAL_API_KEY v Lovable Cloud secretoch. Tu konfigurujte model a limity.",
    fields: [
      {
        key: "mistral_model",
        label: "Mistral model",
        placeholder: "mistral-large-latest",
      },
      {
        key: "mistral_small_model",
        label: "Mistral small model (rýchle úlohy)",
        placeholder: "mistral-small-latest",
      },
      { key: "max_tokens", label: "Max tokens", placeholder: "2048" },
      { key: "temperature", label: "Temperature", placeholder: "0.3" },
    ],
  },
  gcp: {
    label: "Google Cloud",
    description:
      "Service account pre Google Cloud Storage / Vertex AI. Vložte celý service account JSON — uloží sa zašifrovane.",
    fields: [
      { key: "project_id", label: "GCP Project ID" },
      { key: "bucket", label: "Default bucket" },
      {
        key: "service_account_json",
        label: "Service account JSON",
        secret: true,
        textarea: true,
      },
    ],
  },
  wordpress: {
    label: "WordPress",
    description:
      "Spojenie s WordPress REST API (napr. blog GrowMedica). Pre auth použite Application Password.",
    fields: [
      { key: "base_url", label: "Base URL", placeholder: "https://blog.example.com" },
      { key: "username", label: "WP používateľ" },
      { key: "app_password", label: "Application password", secret: true },
    ],
  },
  custom: {
    label: "Custom Webhook",
    description:
      "Vlastný relay endpoint, ktorému budeme posielať preposlané Shopify eventy (Fáza 2 — fan-out engine).",
    fields: [
      { key: "target_url", label: "Target URL", placeholder: "https://hooks.example.com/in" },
      { key: "secret", label: "Shared secret (HMAC)", secret: true },
      {
        key: "events",
        label: "Eventy (čiarkou oddelené)",
        placeholder: "products/create,orders/create",
      },
    ],
  },
};

function GenericConfigCard({ providerId, onSaved }: { providerId: string; onSaved: () => void }) {
  const schema = PROVIDER_SCHEMAS[providerId];
  const upsert = useServerFn(upsertIntegrationConfig);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!schema) {
    return (
      <GlassPanel className="p-6">
        <p className="text-sm text-gm-text-muted">Neznámy provider.</p>
      </GlassPanel>
    );
  }

  async function save() {
    setSaving(true);
    try {
      const config: Record<string, string> = {};
      for (const f of schema.fields) {
        if (form[f.key]) config[f.key] = form[f.key];
      }
      await upsert({
        data: { provider: providerId, name: "default", config },
      });
      toast.success(`${schema.label} uložené.`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassPanel className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{schema.label}</h2>
        <p className="text-sm text-gm-text-muted mt-1 max-w-2xl">{schema.description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {schema.fields.map((f) =>
          f.textarea ? (
            <label key={f.key} className="block text-sm md:col-span-2">
              <span className="text-xs uppercase tracking-wider text-gm-text-muted">{f.label}</span>
              <textarea
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                rows={6}
                className="mt-1 w-full rounded-md border border-gm-border bg-white px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 ring-gm-primary/30"
              />
            </label>
          ) : (
            <Field
              key={f.key}
              label={f.label}
              placeholder={f.placeholder}
              secret={f.secret}
              value={form[f.key] ?? ""}
              onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
            />
          ),
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-gm-primary text-white px-5 py-2 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Ukladám…" : "Uložiť konfiguráciu"}
        </button>
        <span className="text-xs text-gm-text-muted self-center">
          Live API volania pre tento provider sa aktivujú vo Fáze 2 / 3.
        </span>
      </div>
    </GlassPanel>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase tracking-wider text-gm-text-muted">{label}</span>
      <div className="mt-1 flex">
        <input
          type={secret && !reveal ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? ""}
          className="flex-1 rounded-md border border-gm-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ring-gm-primary/30"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="ml-2 text-xs px-2 rounded-md border border-gm-border bg-white hover:bg-gm-bg-soft"
          >
            {reveal ? "Skryť" : "Zobraziť"}
          </button>
        )}
      </div>
    </label>
  );
}

function ResultRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {label}
      </div>
      {detail && <div className="text-xs mt-1 break-all">{detail}</div>}
    </div>
  );
}

function StatusLine({
  label,
  ok,
  okText,
  badText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gm-text-muted">{label}</span>
      <span
        className={`inline-flex items-center gap-1 font-medium ${
          ok ? "text-green-700" : "text-red-700"
        }`}
      >
        {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        <span className="font-mono">{ok ? okText : badText}</span>
      </span>
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-gm-border bg-white px-3 py-2 text-xs">
        {value}
      </code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="text-xs px-3 py-2 rounded-md border border-gm-border bg-white hover:bg-gm-bg-soft inline-flex items-center gap-1"
      >
        <Copy className="w-3.5 h-3.5" /> {copied ? "Skopírované" : "Kopírovať"}
      </button>
    </div>
  );
}
