import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { GlassPanel } from "./AdminShell";

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  empty,
}: {
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  rows: T[];
  loading: boolean;
  empty: ReactNode;
}) {
  if (loading) {
    return (
      <GlassPanel className="p-8 flex items-center gap-2 text-sm text-gm-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Načítavam…
      </GlassPanel>
    );
  }
  if (rows.length === 0) {
    return <GlassPanel className="p-8 text-sm text-gm-text-muted">{empty}</GlassPanel>;
  }
  return (
    <GlassPanel className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-gm-bg-soft text-gm-text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="text-left px-4 py-2.5 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-gm-border">
              {columns.map((c) => (
                <td key={c.key} className="px-4 py-2.5 align-top">
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </GlassPanel>
  );
}
