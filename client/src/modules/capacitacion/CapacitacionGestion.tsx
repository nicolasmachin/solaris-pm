import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { GestionContenido } from "./GestionContenido";
import { GestionSecciones } from "./GestionSecciones";
import { GestionSeguimiento } from "./GestionSeguimiento";

type Tab = "areas" | "contenido" | "seguimiento";

// Pantalla de gestión del módulo (CAPACITACION:EDIT): armar las áreas y sus
// roles, cargar el contenido y ver quién vio qué.
export function CapacitacionGestion() {
  const [tab, setTab] = useState<Tab>("contenido");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "contenido", label: "Contenido" },
    { id: "areas", label: "Áreas y roles" },
    { id: "seguimiento", label: "Seguimiento" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/capacitacion"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft size={14} /> Capacitación
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Gestionar capacitación
        </h1>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-[1px] whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${
              tab === t.id
                ? "border-[var(--color-accent)] font-medium text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "contenido" && <GestionContenido />}
      {tab === "areas" && <GestionSecciones />}
      {tab === "seguimiento" && <GestionSeguimiento />}
    </div>
  );
}
