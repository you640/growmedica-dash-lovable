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
import { testWordPressConnection, listWordPressPosts } from "@/lib/wordpress.functions";
import { dashboardHealth } from "@/lib/dashboard-bff.functions";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  Cloud,
  Flame,
  Sparkles,
  Server,
  Globe,
  Webhook,
  Link2,
} from "lucide-react";

export const Route = createFileRoute("/admin/nastavenia")({
  head: () => ({
    meta: [
      { title: "Nastavenia — GrowMedica Admin" },
      {
        name: "description",
        content:
          "Integration Hub: WordPress REST API, Lovable Cloud, Vercel, Mistral AI a vlastné webhooky.",
      },
      { property: "og:title", content: "Nastavenia — GrowMedica Admin" },
      {
        property: "og:description",
        content: "Integration Hub pre WordPress a ostatné služby GrowMedica.",
      },
    ],
  }),
  component: SettingsPage,
});

const PROVIDERS = [
  { id: "wordpress", label: "WordPress", icon: Globe },
  { id: "storefront_bff", label: "Storefront BFF", icon: Link2 },
  { id: "lovable_cloud", label: "Lovable Cloud", icon: Database },
  { id: "vercel", label: "Vercel", icon: Cloud },
  { id: "firebase", label: "Firebase", icon: Flame },
  { id: "mistral_ai", label: "Mistral AI", icon: Sparkles },
  { id: "gcp", label: "Google Cloud", icon: Server },
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
  const [tab, setTab] = useState<Tab>("wordpress");
  const listFn = useServerFn(listIntegrations);
  const healthFn = useServerFn(dashboardHealth);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [liveHealth, setLiveHealth] = useState<Awaited<ReturnType<typeof healthFn>> | null>(
    null,
  );

  async function refresh() {
    const r = await listFn();
    setIntegrations(r.integrations as IntegrationRow[]);
  }

  async function syncLiveBff() {
    try {
      const h = await healthFn();
      setLiveHealth(h);
      await refresh();
    } catch {
      /* Hub still usable without BFF */
    }
  }

  useEffect(() => {
    void (async () => {
      await refresh().catch(() => undefined);
      await syncLiveBff();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusFor = (id: string) =>
    integrations.find((i) => i.provider === id)?.status ?? "disconnected";

  return (
    <div>
      <SectionHeading
        title="Integration Hub"
        subtitle="Pripojte WordPress, Lovable Cloud, Vercel, Firebase, Mistral, GCP a vlastné webhooky. Storefront BFF syncne živý stav (catalog/mistral/writes)."
      />

      {liveHealth && (
        <GlassPanel className="p-4 mb-4 text-sm">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted mb-2">
            Živý stav (BFF health)
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span>
              catalog: <strong>{liveHealth.catalog ?? "—"}</strong>
            </span>
            <span>
              mistral: <strong>{liveHealth.mistral ?? "—"}</strong>
            </span>
            <span>
              write_mode: <strong>{liveHealth.write_mode ?? "—"}</strong>
            </span>
            <span>
              cms: <strong>{liveHealth.cms_provider ?? "—"}</strong>
            </span>
            <span>
              redis: <strong>{liveHealth.redis ? "yes" : "no"}</strong>
            </span>
            {!liveHealth.ok && (
              <span className="text-red-700">{liveHealth.error ?? "BFF error"}</span>
            )}
          </div>
        </GlassPanel>
      )}

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
          {tab === "lovable_cloud" && <LovableCloudCard />}
          {tab === "wordpress" && <WordPressCard onSaved={refresh} />}
          {tab === "storefront_bff" && (
            <StorefrontBffCard
              onSaved={async () => {
                await syncLiveBff();
              }}
            />
          )}
          {tab !== "lovable_cloud" && tab !== "wordpress" && tab !== "storefront_bff" && (
            <GenericConfigCard providerId={tab} onSaved={refresh} />
          )}
        </div>
      </div>
    </div>
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
          webhook_events, sync_jobs.
        </p>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Posledné webhook eventy</div>
        {loading ? (
          <div className="text-sm text-gm-text-muted">Načítavam…</div>
        ) : events.length === 0 ? (
          <div className="text-sm text-gm-text-muted">
            Zatiaľ žiadne. Po nakonfigurovaní webhooku sa tu objavia.
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

function StorefrontBffCard({ onSaved }: { onSaved: () => void }) {
  const healthFn = useServerFn(dashboardHealth);
  type Health = Awaited<ReturnType<typeof healthFn>>;
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Health | null>(null);

  async function runTest() {
    setTesting(true);
    try {
      const r = await healthFn();
      setResult(r);
      if (r.ok)
        toast.success(`BFF OK · katalog ${r.catalog ?? "?"} · writes ${r.write_mode ?? "?"}`);
      else toast.error(r.error ?? "BFF health zlyhal.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <GlassPanel className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Storefront BFF</h2>
        <p className="text-sm text-gm-text-muted mt-1 max-w-2xl">
          Proxy na Next storefront <span className="font-mono">/api/dashboard/*</span> cez server
          header <span className="font-mono">x-dashboard-agent-secret</span>. Env:{" "}
          <span className="font-mono">STOREFRONT_BFF_BASE_URL</span>,{" "}
          <span className="font-mono">DASHBOARD_AGENT_SECRET</span> (server-only, nie{" "}
          <span className="font-mono">VITE_*</span>).
        </p>
      </div>

      <button
        onClick={runTest}
        disabled={testing}
        className="rounded-full bg-gm-primary text-white px-5 py-2 text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
      >
        {testing && <Loader2 className="w-4 h-4 animate-spin" />}
        Test GET /api/dashboard/health
      </button>

      {result && (
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <ResultRow
            label="Konfigurácia"
            ok={result.configured !== false && !result.error?.includes("chýba")}
            detail={
              result.configured === false
                ? (result.error ?? "Env chýba")
                : "STOREFRONT_BFF_BASE_URL + secret OK"
            }
          />
          <ResultRow
            label="Auth health"
            ok={!!result.ok && !result.error}
            detail={
              result.error ?? `catalog=${result.catalog ?? "—"} · mistral=${result.mistral ?? "—"}`
            }
          />
          <ResultRow
            label="Write mode"
            ok={!!result.write_mode}
            detail={result.write_mode ?? "—"}
          />
          <ResultRow
            label="CMS / Redis"
            ok={!!result.cms_provider}
            detail={`cms=${result.cms_provider ?? "—"} · redis=${result.redis ? "yes" : "no"}`}
          />
        </div>
      )}
    </GlassPanel>
  );
}

function WordPressCard({ onSaved }: { onSaved: () => void }) {
  const test = useServerFn(testWordPressConnection);
  const listPosts = useServerFn(listWordPressPosts);
  type TestResult = Awaited<ReturnType<typeof test>>;
  type PostsResult = Awaited<ReturnType<typeof listPosts>>;

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [posts, setPosts] = useState<PostsResult["posts"]>([]);

  async function runTest() {
    setTesting(true);
    try {
      const r = await test();
      setResult(r);
      if (r.ok) toast.success(`Pripojené: ${r.siteName ?? r.siteUrl ?? "WordPress"}`);
      else toast.error(r.error ?? "Test pripojenia zlyhal.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function loadPosts() {
    setLoadingPosts(true);
    try {
      const r = await listPosts({ data: { perPage: 5, page: 1, status: "publish" } });
      setPosts(r.posts);
      if (r.error) toast.error(`Načítanie príspevkov zlyhalo: ${r.error}`);
      else if (r.posts.length === 0) toast.info("Žiadne publikované príspevky.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingPosts(false);
    }
  }

  return (
    <GlassPanel className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">WordPress</h2>
        <p className="text-sm text-gm-text-muted mt-1 max-w-2xl">
          Self-hosted WordPress REST API (<span className="font-mono">/wp-json/wp/v2</span>) cez
          Lovable konektor. Site URL a Application Password sú uložené v konektore — v aplikácii
          nikdy neopúšťajú server.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={runTest}
          disabled={testing}
          className="rounded-full bg-gm-primary text-white px-5 py-2 text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {testing && <Loader2 className="w-4 h-4 animate-spin" />}
          Test pripojenia
        </button>
        <button
          onClick={loadPosts}
          disabled={loadingPosts}
          className="rounded-full border border-gm-border bg-white px-5 py-2 text-sm hover:bg-gm-bg-soft disabled:opacity-50 inline-flex items-center gap-2"
        >
          {loadingPosts && <Loader2 className="w-4 h-4 animate-spin" />}
          Načítať posledné príspevky
        </button>
      </div>

      {result && (
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <ResultRow
            label="REST API auth"
            ok={result.ok}
            detail={
              result.ok
                ? `Používateľ: ${result.user ?? "?"}${result.isSuperAdmin ? " (super admin)" : ""}`
                : (result.error ?? "Neznáma chyba")
            }
          />
          <ResultRow
            label="Stránka"
            ok={!!result.siteUrl}
            detail={`${result.siteName ?? ""} ${result.siteUrl ?? ""}`.trim() || "Neznáma"}
          />
          <ResultRow
            label="Obsah"
            ok={(result.counts.posts ?? 0) >= 0 && result.ok}
            detail={`Príspevky: ${result.counts.posts ?? "?"} · Stránky: ${
              result.counts.pages ?? "?"
            } · Média: ${result.counts.media ?? "?"}`}
          />
          <ResultRow
            label="REST namespaces"
            ok={result.restNamespaces.length > 0}
            detail={`${result.restNamespaces.slice(0, 8).join(", ") || "—"}${
              result.wooDetected ? " · WooCommerce detegované" : ""
            }`}
          />
        </div>
      )}

      {posts.length > 0 && (
        <div className="overflow-auto rounded-md border border-gm-border">
          <table className="w-full text-xs">
            <thead className="bg-gm-bg-soft text-gm-text-muted">
              <tr>
                <th className="text-left px-3 py-2">Dátum</th>
                <th className="text-left px-3 py-2">Titulok</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t border-gm-border">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.date ? new Date(p.date).toLocaleDateString("sk-SK") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {p.link ? (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline text-gm-text"
                      >
                        {p.title}
                      </a>
                    ) : (
                      p.title
                    )}
                  </td>
                  <td className="px-3 py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      "Vlastný relay endpoint, ktorému budeme posielať preposlané WordPress eventy (fan-out engine).",
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
