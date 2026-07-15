import { createFileRoute } from "@tanstack/react-router";
import { PhaseStub } from "@/components/admin/PhaseStub";
import { Package } from "lucide-react";

export const Route = createFileRoute("/admin/produkty")({
  component: () => (
    <PhaseStub
      title="Produkty"
      subtitle="Shopify produkty + AI SEO optimalizácia."
      phase="Fáza 2"
      icon={<Package className="w-5 h-5" />}
      bullets={[
        "Live tabuľka produktov zo Shopify Admin API",
        "AI drawer pre Mistral SEO rewrite (title, meta, popis)",
        "Bulk akcie a inline status toggle",
        "Sync metafields a kategórií",
      ]}
      cta={{ label: "Pripojiť Shopify v Nastaveniach", to: "/admin/nastavenia" }}
    />
  ),
});