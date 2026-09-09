import { useNavigate } from "react-router-dom";
import { FileCheck, HardHat, Handshake, HardDrive, Sun } from "lucide-react";

import { usePermission } from "../../hooks/usePermission";

/**
 * Los enlaces al mismo cliente en los otros módulos.
 *
 * Existe porque cada módulo se los había armado por su cuenta: el proyecto tenía
 * dos enlaces sueltos metidos entre los datos del header ("UTE: … Ver →",
 * "Ingeniería: Abrir workspace →"), la ficha del cliente un botón grande, y el
 * workspace de Ingeniería ninguno. Distinto texto, distinto lugar y cobertura
 * distinta según de dónde vinieras.
 *
 * Dos decisiones:
 *
 *  - **El orden sigue el ciclo de vida del cliente** —venta → obra → ingeniería →
 *    trámite → posventa—, no la importancia de cada módulo. Así la misma fila
 *    sirve de mapa del proceso, y está en el mismo orden en todas las pantallas.
 *  - **No se ofrece lo que la persona no puede abrir.** Un enlace que rebota con
 *    "no tenés permiso" es peor que no tenerlo: enseña que la app miente.
 */

export type ModuloCliente = "ventas" | "proyecto" | "ingenieria" | "ute" | "experiencia";

type Destino = {
  id: ModuloCliente;
  label: string;
  icon: typeof HardHat;
  modulo: string;
  href: string | null;
};

export function EnlacesModulos({
  actual,
  projectId,
  leadId,
  uteProcessId,
  className = "",
}: {
  /** El módulo desde el que se mira: se muestra marcado y sin enlace. */
  actual: ModuloCliente;
  projectId: string | null;
  /** Lead de origen. Sin él no hay a dónde ir en Ventas. */
  leadId?: string | null;
  uteProcessId?: string | null;
  className?: string;
}) {
  const navigate = useNavigate();
  const puede: Record<string, boolean> = {
    VENTAS: usePermission("VENTAS", "VIEW"),
    OPERACIONES: usePermission("OPERACIONES", "VIEW"),
    INGENIERIA: usePermission("INGENIERIA", "VIEW"),
    TRAMITES_UTE: usePermission("TRAMITES_UTE", "VIEW"),
    EXPERIENCIA_CLIENTES: usePermission("EXPERIENCIA_CLIENTES", "VIEW"),
  };

  const destinos: Destino[] = [
    {
      id: "ventas",
      label: "Ventas",
      icon: Handshake,
      modulo: "VENTAS",
      href: leadId ? `/ventas?lead=${leadId}` : null,
    },
    {
      id: "proyecto",
      label: "Proyecto",
      icon: HardDrive,
      modulo: "OPERACIONES",
      href: projectId ? `/projects/${projectId}` : null,
    },
    {
      id: "ingenieria",
      label: "Ingeniería",
      icon: HardHat,
      modulo: "INGENIERIA",
      href: projectId ? `/ingenieria/proyecto/${projectId}` : null,
    },
    {
      id: "ute",
      label: "Trámite UTE",
      icon: FileCheck,
      modulo: "TRAMITES_UTE",
      href: uteProcessId ? `/tramites-ute?highlight=${uteProcessId}` : null,
    },
    {
      id: "experiencia",
      label: "Experiencia Solar",
      icon: Sun,
      modulo: "EXPERIENCIA_CLIENTES",
      href: projectId ? `/clientes/${projectId}` : null,
    },
  ];

  // Se muestran los que la persona puede abrir, más el actual (para que se vea
  // dónde está parada aunque no tenga permiso de listado en ese módulo).
  const visibles = destinos.filter((d) => d.id === actual || (puede[d.modulo] && d.href));
  if (visibles.length <= 1) return null;

  return (
    <nav aria-label="El mismo cliente en otros módulos" className={`flex flex-wrap items-center gap-1 ${className}`}>
      {visibles.map((d) => {
        const esActual = d.id === actual;
        const Icon = d.icon;
        return (
          <button
            key={d.id}
            type="button"
            disabled={esActual || !d.href}
            onClick={() => d.href && navigate(d.href)}
            title={esActual ? `Estás en ${d.label}` : `Ver este cliente en ${d.label}`}
            aria-current={esActual ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              esActual
                ? "cursor-default border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {d.label}
          </button>
        );
      })}
    </nav>
  );
}
