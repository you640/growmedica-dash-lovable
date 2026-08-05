import { Link } from "@tanstack/react-router";
import { GlassPanel, SectionHeading } from "./AdminShell";
import { Settings, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  phase: string;
  bullets: string[];
  cta?: { label: string; to: string } | null;
  icon?: ReactNode;
};

export function PhaseStub({ title, subtitle, phase, bullets, cta, icon }: Props) {
  return (
    <div>
      <SectionHeading title={title} subtitle={subtitle} />
      <GlassPanel className="p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-gm-lg bg-[var(--gm-primary)]/10 text-gm-primary flex items-center justify-center">
            {icon ?? <Settings className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gm-primary">
              {phase}
            </div>
            <h2 className="text-lg font-semibold mt-1">Modul je pripravený, čaká na pripojenie integrácie</h2>
            <p className="text-sm text-gm-text-muted mt-1 max-w-xl">
              Po pripojení WordPressu v Nastaveniach sa sem napoja live dáta.
            </p>
          </div>
        </div>

        <ul className="grid gap-2 md:grid-cols-2 text-sm text-gm-text-muted">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gm-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {cta && (
          <Link
            to={cta.to}
            className="inline-flex items-center gap-2 rounded-full bg-gm-primary text-white px-5 py-2.5 text-sm hover:opacity-90"
          >
            {cta.label}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </GlassPanel>
    </div>
  );
}