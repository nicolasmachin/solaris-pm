import { useEffect, useState } from "react";
import { FileText, Filter, Menu, MessagesSquare, Users, X, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

// El marco de Ventas: el menú lateral con las secciones, igual al de
// Administración (AdminSidebar): grupos con título chico, el ítem activo con la
// barra a la izquierda, fijo en la computadora y cajón en el celular.

type Grupo = { label: string; icon: LucideIcon; items: Array<{ to: string; label: string; end?: boolean }> };

const GRUPOS: Grupo[] = [
  { label: "Embudo", icon: Filter, items: [{ to: "/ventas", label: "Pipeline", end: true }] },
  {
    label: "Clientes",
    icon: Users,
    items: [
      { to: "/ventas/contactos", label: "Contactos" },
      { to: "/ventas/empresas", label: "Empresas" },
    ],
  },
  {
    label: "Cotizaciones",
    icon: FileText,
    items: [
      { to: "/ventas/cotizaciones", label: "A medida" },
      { to: "/ventas/articulos", label: "Artículos de venta" },
    ],
  },
  {
    label: "Conversaciones",
    icon: MessagesSquare,
    items: [
      { to: "/ventas/whatsapp", label: "WhatsApp" },
      { to: "/ventas/instagram", label: "Instagram" },
    ],
  },
];

function VentasSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        role="navigation"
        aria-label="Ventas"
        className={`shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-y-auto
          md:static md:flex md:w-60 md:translate-x-0
          ${isOpen ? "fixed inset-y-[52px] left-0 z-50 w-60 flex" : "fixed inset-y-[52px] left-0 z-50 w-60 -translate-x-full md:translate-x-0"}
          transition-transform duration-200 flex-col`}
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-[var(--color-border)] md:hidden">
          <span className="font-display text-sm font-semibold text-[var(--color-text-primary)]">Ventas</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-primary)]"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 py-3">
          {GRUPOS.map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.label} className="mb-5 last:mb-2">
                <div className="mb-1 flex items-center gap-1.5 px-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  <Icon size={11} className="opacity-70" />
                  {g.label}
                </div>
                <ul>
                  {g.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex w-full items-center border-l-2 px-4 py-2 text-left text-sm transition-colors ${
                            isActive
                              ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 font-semibold text-[var(--color-text-primary)]"
                              : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]/40 hover:text-[var(--color-text-primary)]"
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export function VentasLayout() {
  const [abierto, setAbierto] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setAbierto(false), [pathname]);
  return (
    <div className="flex h-[calc(100vh-52px)] min-h-0 bg-[var(--color-bg-app)]">
      <VentasSidebar isOpen={abierto} onClose={() => setAbierto(false)} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú de Ventas"
          className="absolute left-4 top-4 z-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] md:hidden"
        >
          <Menu size={16} />
        </button>
        <Outlet />
      </main>
    </div>
  );
}
