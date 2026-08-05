import { createFileRoute } from "@tanstack/react-router";
import { PhaseStub } from "@/components/admin/PhaseStub";
import { Package } from "lucide-react";

export const Route = createFileRoute("/admin/produkty")({
  head: () => ({
    meta: [
      { title: "Produkty — GrowMedica Admin" },
      {
        name: "description",
        content: "Produkty z WooCommerce (WordPress) a AI SEO optimalizácia cez Mistral.",
      },
      { property: "og:title", content: "Produkty — GrowMedica Admin" },
      { property: "og:description", content: "Produkty z WooCommerce a AI SEO optimalizácia." },
    ],
  }),
  component: () => (
    <PhaseStub
      title="Produkty"
      subtitle="WooCommerce produkty + AI SEO optimalizácia."
      phase="Fáza 2"
      icon={<Package className="w-5 h-5" />}
      bullets={[
        "Live tabuľka produktov z WooCommerce REST API",
        "AI drawer pre Mistral SEO rewrite (title, meta, popis)",
        "Bulk akcie a inline status toggle",
        "Sync atribútov a kategórií",
      ]}
      cta={{ label: "Pripojiť WordPress v Nastaveniach", to: "/admin/nastavenia" }}
    />
  ),
});