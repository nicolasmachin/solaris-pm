import { NavLink, Outlet } from "react-router-dom";

import { usePermission } from "../hooks/usePermission";

// Layout de "Mis tareas" con tabs por URL. Concentra lo accionable del día:
// Tareas (índice), Pendientes (traspasos por confirmar) y —desde la Fase C—
// Tickets. Cada tab es una ruta hija (ver App.tsx). Las tabs con permiso se
// muestran sólo si el rol lo tiene.
export function MisTareasLayout() {
  const canPendientes = usePermission("TRASPASOS", "VIEW");
  const canTickets = usePermission("TICKETS", "VIEW");

  const tabs = [
    { to: "", label: "Tareas", end: true, show: true },
    { to: "pendientes", label: "Pendientes", end: false, show: canPendientes },
    { to: "tickets", label: "Tickets", end: false, show: canTickets },
  ].filter((t) => t.show);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
        Mis tareas
      </h1>

      <div className="flex items-center gap-1 border-b border-[var(--color-border)] overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to || "index"}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-[1px] transition-colors",
                isActive
                  ? "border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
              ].join(" ")
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
