import { useEffect } from "react";
import { Briefcase, Settings, Users, Workflow, X, type LucideIcon } from "lucide-react";

// Sidebar lateral del panel de Administración. Reemplaza la tira de tabs
// horizontales que mezclaba 12 secciones sin jerarquía. Acá los items se
// agrupan en 4 categorías. La estructura está en una constante exportable
// para que el caller (Admin.tsx) pueda usarla también para validar el
// query param `tab`.
//
// En desktop el sidebar es un panel fijo a la izquierda; en mobile se
// renderiza como drawer overlay controlado por isOpen/onClose.

export interface AdminSidebarItem {
  tab: string;
  label: string;
}

export interface AdminSidebarGroup {
  label: string;
  icon: LucideIcon;
  items: AdminSidebarItem[];
}

// Los `tab` IDs coinciden con los del enum Tab del Admin viejo para
// preservar compatibilidad con URLs literales (ej. ?tab=clientes, no
// ?tab=clientes-portal).
export const ADMIN_GROUPS: AdminSidebarGroup[] = [
  {
    label: "Personas y accesos",
    icon: Users,
    items: [
      { tab: "usuarios", label: "Usuarios" },
      { tab: "permisos", label: "Permisos" },
      { tab: "clientes", label: "Clientes portal" },
    ],
  },
  {
    label: "Configuración del negocio",
    icon: Briefcase,
    items: [
      { tab: "equipos", label: "Equipos instaladores" },
      { tab: "finanzas", label: "Subcategorías" },
      { tab: "costos-fijos", label: "Costos fijos" },
      { tab: "materiales", label: "Materiales" },
      { tab: "cuentas", label: "Cuentas" },
    ],
  },
  {
    label: "Procesos y reglas",
    icon: Workflow,
    items: [
      { tab: "pipeline", label: "Pipeline default" },
      { tab: "deadlines", label: "Reglas de Deadlines" },
      { tab: "checklist-obra", label: "Plantilla de checklist" },
      { tab: "plantillas-email", label: "Plantillas de email" },
      { tab: "objetivos", label: "Objetivos" },
    ],
  },
  {
    label: "Sistema",
    icon: Settings,
    items: [
      { tab: "configuracion", label: "Configuración del sistema" },
    ],
  },
];

// Set con todos los tabs válidos, para que el caller pueda validar el
// query param sin tener que hardcodear la lista en otro lugar.
export const ADMIN_TAB_IDS: ReadonlySet<string> = new Set(
  ADMIN_GROUPS.flatMap((g) => g.items.map((i) => i.tab)),
);

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  // Mobile drawer: si isOpen, el sidebar se muestra como overlay full-height
  // sobre el contenido. En desktop (md y mayor) isOpen se ignora — el
  // sidebar está siempre visible.
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ activeTab, onTabChange, isOpen = false, onClose }: Props) {
  // Cerrar el drawer con Escape (solo si está abierto en mobile).
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay mobile: oscurece el resto cuando el drawer está abierto.
          Click cierra el drawer. Solo se ve en pantallas chicas. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        aria-label="Administración"
        className={`shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-y-auto
          md:static md:flex md:w-60 md:translate-x-0
          ${isOpen
            ? "fixed inset-y-[52px] left-0 z-50 w-60 flex"
            : "fixed inset-y-[52px] left-0 z-50 w-60 -translate-x-full md:translate-x-0"}
          transition-transform duration-200 flex-col`}
      >
        {/* Header del drawer mobile con botón cerrar. Oculto en desktop. */}
        {onClose && (
          <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-[var(--color-border)] md:hidden">
            <span className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
              Administración
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar menú"
              className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-primary)]"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <nav className="flex-1 py-3">
          {ADMIN_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.label} className="mb-5 last:mb-2">
                <div className="flex items-center gap-1.5 px-4 mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  <Icon size={11} className="opacity-70" />
                  {group.label}
                </div>
                <ul>
                  {group.items.map((item) => {
                    const isActive = item.tab === activeTab;
                    return (
                      <li key={item.tab}>
                        <button
                          type="button"
                          onClick={() => onTabChange(item.tab)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex w-full items-center px-4 py-2 text-left text-sm transition-colors border-l-2 ${
                            isActive
                              ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-text-primary)] font-semibold"
                              : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]/40 hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
