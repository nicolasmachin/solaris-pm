import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import type { ViabilityResult } from "../../types/proposals-v2";

// Dos indicadores de viabilidad para el sub-header: "Ahorro N%" (sin ícono) y
// "Espacio {ocupado}/{disponible} m²" con ícono según estado. Muestra "—" si
// falta el dato. Se apaga (60%) cuando el autosave está fallando (stale).
export function ViabilityIndicators({ data, stale }: { data: ViabilityResult | undefined; stale: boolean }) {
  const ahorro = data?.ahorroPorcentaje ?? null;
  const ocupado = data?.espacioOcupado ?? null;
  const disponible = data?.espacioDisponible ?? null;
  const estado = data?.estado ?? "unknown";

  const espacioOk = ocupado != null && disponible != null;
  const icon = !espacioOk
    ? null
    : estado === "ok"
      ? <CheckCircle2 size={14} className="text-green-400" />
      : estado === "warning"
        ? <AlertTriangle size={14} className="text-amber-400" />
        : estado === "error"
          ? <XCircle size={14} className="text-red-400" />
          : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)] ${
        stale ? "opacity-60" : ""
      }`}
    >
      <span className="whitespace-nowrap">{ahorro == null ? "Ahorro —" : `Ahorro ${ahorro}%`}</span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {icon}
        {espacioOk ? `Espacio ${ocupado}/${disponible} m²` : "Espacio —"}
      </span>
    </div>
  );
}
