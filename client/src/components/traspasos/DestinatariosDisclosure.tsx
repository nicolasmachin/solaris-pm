import { useState } from "react";
import { ChevronDown } from "lucide-react";

import type { TraspasoDestinatario } from "../../api/traspasos.api";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  ASESOR_COMERCIAL: "Ventas",
  FINANZAS: "Finanzas",
  POSTVENTA: "Post-Habilitación",
  TRAMITACION_UTE: "Trámites UTE",
  EXPERIENCIA_SOLAR: "Experiencia Solar",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.charAt(0) + role.slice(1).toLowerCase();
}

// Muestra "Se notifica a: <resumen por rol>" con un desplegable que lista las
// personas concretas (nombre + rol, marcando las copias). Compartido entre el
// popup instantáneo y la bandeja de Pendientes.
export function DestinatariosDisclosure({
  preview,
  destinatarios,
}: {
  preview: string[];
  destinatarios: TraspasoDestinatario[];
}) {
  const [open, setOpen] = useState(false);
  if (preview.length === 0) return null;

  const total = destinatarios.length;

  return (
    <div className="mt-2">
      <div className="flex items-start gap-1 text-[12px] text-[var(--color-text-muted)]">
        <span>Se notifica a: {preview.join(" · ")}</span>
        {total > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-0.5 text-[var(--color-accent)] hover:underline"
            aria-expanded={open}
          >
            {open ? "ocultar" : `ver ${total}`}
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {open && total > 0 && (
        <ul className="mt-1.5 space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
          {destinatarios.map((d, i) => (
            <li key={`${d.nombre}-${d.roleName}-${i}`} className="flex items-center gap-2 text-[12px]">
              <span className="text-[var(--color-text-primary)]">{d.nombre || "(sin nombre)"}</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                {roleLabel(d.roleName)}
              </span>
              {d.esCopia && (
                <span className="rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  copia
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
