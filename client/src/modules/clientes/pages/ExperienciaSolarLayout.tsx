import { NavLink, Outlet } from "react-router-dom";

// Layout de "Experiencia Solar" con tabs por URL: Generadores (índice) y
// Encuestas. Cada tab es una ruta hija (ver App.tsx). El acceso al módulo está
// gateado en App.tsx con EXPERIENCIA_CLIENTES:VIEW; la data de encuestas exige
// además ENCUESTAS:VIEW en el backend (todos los roles con acceso al módulo la
// tienen).
export function ExperienciaSolarLayout() {
  const tabs = [
    { to: "", label: "Generadores", end: true },
    { to: "recorrido", label: "Recorrido", end: false },
    { to: "reportes", label: "Reportes FV", end: false },
    { to: "monitoreo", label: "Monitoreo", end: false },
    { to: "cobros", label: "Cobros", end: false },
    { to: "encuestas", label: "Encuestas", end: false },
  ];

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Experiencia Solar
        </h1>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)]">
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
