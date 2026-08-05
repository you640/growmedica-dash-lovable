import { createFileRoute } from "@tanstack/react-router";
import { PhaseStub } from "@/components/admin/PhaseStub";
import { ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/admin/objednavky")({
  head: () => ({
    meta: [
      { title: "Objednávky — GrowMedica Admin" },
      {
        name: "description",
        content: "Live feed objednávok z WooCommerce s fulfilment akciami.",
      },
      { property: "og:title", content: "Objednávky — GrowMedica Admin" },
      { property: "og:description", content: "Objednávky z WooCommerce v reálnom čase." },
    ],
  }),
  component: () => (
    <PhaseStub
      title="Objednávky"
      subtitle="Live feed objednávok z WooCommerce s fulfilment akciami."
      phase="Fáza 2"
      icon={<ShoppingCart className="w-5 h-5" />}
      bullets={[
        "Real-time stream cez WooCommerce order webhook",
        "Filter podľa statusu, dátumu a sumy",
        "Quick view zákazníka a položiek",
        "AI sumarizácia a riziko fraud detection",
      ]}
      cta={{ label: "Pripojiť WordPress v Nastaveniach", to: "/admin/nastavenia" }}
    />
  ),
});