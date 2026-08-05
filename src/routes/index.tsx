import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GrowMedica Admin" },
      { name: "description", content: "Headless commerce command center pre GrowMedica / NOOR." },
      { property: "og:title", content: "GrowMedica Admin" },
      {
        property: "og:description",
        content: "Headless commerce command center pre GrowMedica / NOOR.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <Navigate to="/admin" />;
}
