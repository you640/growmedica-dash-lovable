import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminAuthGate } from "@/components/admin/AdminAuthGate";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Login page renders without the gate or shell to avoid redirect loops.
  if (pathname === "/admin/prihlasenie") {
    return <Outlet />;
  }
  return (
    <AdminAuthGate>
      <AdminShell>
        <Outlet />
      </AdminShell>
    </AdminAuthGate>
  );
}
