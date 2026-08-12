import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GlassPanel, SectionHeading } from "@/components/admin/AdminShell";
import { getStoreOverview, type StoreOverview } from "@/lib/wp-data.functions";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({
    meta: [
      { title: "Agentic AI — GrowMedica Admin" },
      { name: "description", content: "Stav Mistral AI agenta pre GrowMedica katalóg a obsah." },
      { property: "og:title", content: "Agentic AI — GrowMedica Admin" },
      { property: "og:description", content: "Stav Mistral AI agenta pre GrowMedica." },
    ],
  }),
  component: AiPage,
});

function AiPage() {
  const fn = useServerFn(getStoreOverview);
  const [data, setData] = useState<StoreOverview | null>(null);

  useEffect(() => {
    fn()
      .then(setData)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mistral = data?.health?.mistral ?? null;
  const ready = mistral === "ready" || mistral === "ok" || mistral === "configured";

  return (
    <div>
      <SectionHeading
        title="Agentic AI"
        subtitle="Mistral agent beží na strane storefront BFF a pracuje nad živým katalógom."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Mistral stav</div>
          <div
            className={`text-2xl font-semibold mt-2 ${ready ? "text-green-700" : "text-gm-text"}`}
          >
            {mistral ?? "—"}
          </div>
        </GlassPanel>
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">CMS</div>
          <div className="text-2xl font-semibold mt-2">{data?.health?.cmsProvider ?? "—"}</div>
        </GlassPanel>
        <GlassPanel className="p-6">
          <div className="text-xs uppercase tracking-wider text-gm-text-muted">Katalóg</div>
          <div className="text-2xl font-semibold mt-2">{data?.health?.catalog ?? "—"}</div>
        </GlassPanel>
      </div>

      <GlassPanel className="mt-6 p-6 text-sm text-gm-text-muted space-y-2">
        <p>
          Agent používa dashboard API na obchode GrowMedica. Ak je stav prázdny alebo chybný,
          skontrolujte pripojenie v{" "}
          <Link to="/admin/diagnostika" className="text-gm-primary hover:underline">
            Diagnostike
          </Link>
          .
        </p>
        {data?.error && <p className="text-red-700">{data.error}</p>}
        <p>
          Nastavenia modelu a limitov:{" "}
          <Link to="/admin/nastavenia" className="text-gm-primary hover:underline">
            Nastavenia → Mistral AI
          </Link>
          .
        </p>
      </GlassPanel>
    </div>
  );
}
