import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getBandejaES } from "../../../api/whatsapp.api";

// Layout de "Experiencia Solar" con tabs por URL: Generadores (índice) y
// Encuestas. Cada tab es una ruta hija (ver App.tsx). El acceso al módulo está
// gateado en App.tsx con EXPERIENCIA_CLIENTES:VIEW; la data de encuestas exige
// además ENCUESTAS:VIEW en el backend (todos los roles con acceso al módulo la
// tienen).
export function ExperienciaSolarLayout() {
  // Mismo pedido que la bandeja (misma clave): el número de la pestaña son las
  // conversaciones con un mensaje del cliente sin contestar.
  const { data: bandeja } = useQuery({
    queryKey: ["whatsapp-es", "bandeja"],
    queryFn: getBandejaES,
    refetchInterval: 30000,
  });
  const sinContestar = bandeja?.conversaciones.filter((c) => c.sinContestar).length ?? 0;
  const tabs = [
    { to: "", label: "Generadores", end: true },
    { to: "recorrido", label: "Recorrido", end: false },
    { to: "whatsapp", label: "WhatsApp", end: false, contador: sinContestar },
    { to: "reportes", label: "Reportes FV", end: false },
    { to: "monitoreo", label: "Monitoreo", end: false },
    { to: "cobros", label: "Cobros", end: false },
    { to: "plan-granizo", label: "Plan granizo", end: false },
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
            {"contador" in tab && tab.contador ? (
              <span
                className="ml-1.5 rounded-full bg-[var(--color-danger-bg)] px-1.5 text-[11px] font-semibold text-[var(--color-danger-text)]"
                title="Conversaciones con un mensaje del cliente sin contestar"
              >
                {tab.contador}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
