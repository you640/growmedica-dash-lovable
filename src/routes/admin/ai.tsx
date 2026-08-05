import { createFileRoute } from "@tanstack/react-router";
import { PhaseStub } from "@/components/admin/PhaseStub";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/ai")({
  head: () => ({
    meta: [
      { title: "Agentic AI — GrowMedica Admin" },
      { name: "description", content: "AI command bar s Mistral modelmi naprieč integráciami." },
      { property: "og:title", content: "Agentic AI — GrowMedica Admin" },
      { property: "og:description", content: "AI command bar s Mistral modelmi." },
    ],
  }),
  component: () => (
    <PhaseStub
      title="Agentic AI"
      subtitle="Command Bar — píšte príkazy a agenti vykonajú akcie naprieč integráciami."
      phase="Fáza 3"
      icon={<Sparkles className="w-5 h-5" />}
      bullets={[
        "Mistral ako primárny LLM (mistral-large-latest)",
        "Akcie: optimalizácia produktov, hromadné updaty, exporty",
        "Pamäť kontextu medzi turnami",
        "Audit log všetkých AI akcií",
      ]}
      cta={{ label: "Pripojiť Mistral v Nastaveniach", to: "/admin/nastavenia" }}
    />
  ),
});
