import { createFileRoute } from "@tanstack/react-router";
import { PhaseStub } from "@/components/admin/PhaseStub";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/admin/analytika")({
  head: () => ({
    meta: [
      { title: "Analytika — GrowMedica Admin" },
      { name: "description", content: "Tržby, konverzie, SEO výkon a AI insights pre GrowMedica." },
      { property: "og:title", content: "Analytika — GrowMedica Admin" },
      { property: "og:description", content: "Tržby, konverzie a SEO výkon na jednej obrazovke." },
    ],
  }),
  component: () => (
    <PhaseStub
      title="Analytika"
      subtitle="Tržby, konverzie, SEO výkon a AI insights na jednej obrazovke."
      phase="Fáza 3"
      icon={<BarChart3 className="w-5 h-5" />}
      bullets={[
        "Denné, týždenné a mesačné tržby",
        "Top produkty a kategórie",
        "Sales funnel a opustené košíky",
        "AI narratívne reporty",
      ]}
      cta={{ label: "Pripojiť integrácie", to: "/admin/nastavenia" }}
    />
  ),
});