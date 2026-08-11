import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  Sparkles,
  Settings,
  Stethoscope,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";

const NAV = [
  { icon: LayoutDashboard, label: "Domov", href: "/admin" },
  { icon: ShoppingCart, label: "Objednávky", href: "/admin/objednavky" },
  { icon: Package, label: "Produkty", href: "/admin/produkty" },
  { icon: Users, label: "Zákazníci", href: "/admin/zakaznici" },
  { icon: BarChart3, label: "Analytika", href: "/admin/analytika" },
  { icon: Sparkles, label: "Agentic AI", href: "/admin/ai" },
  { icon: Stethoscope, label: "Diagnostika", href: "/admin/diagnostika" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const NavList = (
    <nav className="flex-1 px-4 space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-gm-lg transition-all duration-300 ${
              active
                ? "bg-[var(--gm-primary)]/10 text-gm-text border border-[var(--gm-primary)]/20 shadow-sm"
                : "text-gm-text-muted hover:bg-gm-bg-soft hover:text-gm-text"
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? "text-gm-primary" : "text-gm-text-muted"}`} />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-[#FDFBF7] text-gm-text">
      {/* Desktop sidebar */}
      <aside className="w-72 hidden md:flex flex-col border-r border-gm-border bg-white/40 backdrop-blur-2xl">
        <div className="p-8">
          <div className="text-2xl font-semibold tracking-tight">
            Grow<span className="text-gm-primary">Medica</span>
          </div>
          <div className="text-xs uppercase tracking-widest text-gm-text-muted mt-1">Admin</div>
        </div>
        {NavList}
        <div className="p-4 border-t border-gm-border text-xs text-gm-text-muted">
          {user?.email}
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-white shadow-xl">
            <div className="p-6 flex items-center justify-between">
              <div className="text-xl font-semibold">
                Grow<span className="text-gm-primary">Medica</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Zavrieť menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            {NavList}
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b border-gm-border bg-white/20 backdrop-blur-md flex items-center px-4 md:px-8 gap-4">
          <button
            className="md:hidden p-2 rounded-md hover:bg-gm-bg-soft"
            onClick={() => setOpen(true)}
            aria-label="Otvoriť menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 relative group">
            <div className="absolute inset-0 bg-[var(--gm-primary)]/5 blur-xl group-focus-within:bg-[var(--gm-primary)]/10 transition-all rounded-full pointer-events-none" />
            <input
              type="text"
              placeholder="Zadajte príkaz pre AI agentov…"
              className="relative w-full bg-white/60 border border-gm-border rounded-full py-3 px-6 pl-12 focus:outline-none focus:ring-2 ring-gm-primary/30 transition-all font-light text-sm italic"
            />
            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gm-primary animate-pulse" />
          </div>
          <Link
            to="/admin/nastavenia"
            className="p-2 rounded-md hover:bg-gm-bg-soft"
            aria-label="Nastavenia"
          >
            <Settings className="w-5 h-5 text-gm-text-muted hover:text-gm-primary transition-colors" />
          </Link>
          <button
            className="p-2 rounded-md hover:bg-gm-bg-soft"
            onClick={async () => {
              await signOut();
              navigate({ to: "/admin/prihlasenie" });
            }}
            aria-label="Odhlásiť sa"
          >
            <LogOut className="w-5 h-5 text-gm-text-muted hover:text-gm-primary transition-colors" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-gm-bg-soft/30 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}

export function GlassPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-gm-lg border border-gm-border bg-white/60 backdrop-blur-md shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-gm-text">{title}</h1>
      {subtitle && <p className="text-sm text-gm-text-muted mt-1 max-w-2xl">{subtitle}</p>}
    </div>
  );
}
