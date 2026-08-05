import { createFileRoute } from "@tanstack/react-router";
import { PhaseStub } from "@/components/admin/PhaseStub";
import { Users } from "lucide-react";

export const Route = createFileRoute("/admin/zakaznici")({
  head: () => ({
    meta: [
      { title: "Zákazníci — GrowMedica Admin" },
      { name: "description", content: "CRM pohľad na zákazníkov z WooCommerce a WordPressu." },
      { property: "og:title", content: "Zákazníci — GrowMedica Admin" },
      { property: "og:description", content: "CRM pohľad na zákazníkov z WooCommerce." },
    ],
  }),
  component: () => (
    <PhaseStub
      title="Zákazníci"
      subtitle="CRM pohľad na zákazníkov z WooCommerce a marketing platformy."
      phase="Fáza 2"
      icon={<Users className="w-5 h-5" />}
      bullets={[
        "Profily zákazníkov, LTV a segmenty",
        "Synchronizácia s WooCommerce customer webhookom",
        "Tagy a poznámky",
        "AI insights — kto kúpi opäť",
      ]}
      cta={{ label: "Pripojiť WordPress v Nastaveniach", to: "/admin/nastavenia" }}
    />
  ),
});