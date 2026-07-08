import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import type { ViabilityResult } from "../../types/proposals-v2";

// Indicadores de viabilidad para el sub-header: "Ahorro N%", "Espacio
// {ocupado}/{disponible} m²" (con ícono según estado), "Potencia N kWp",
// "Retorno N años", "US$ N/kW c/IVA" y el "Precio final US$ N c/IVA" (destacado).
// Muestra "—" si falta el dato. Se apaga (60%) cuando el autosave está fallando (stale).
export function ViabilityIndicators({ data, stale }: { data: ViabilityResult | undefined; stale: boolean }) {
  const ahorro = data?.ahorroPorcentaje ?? null;
  const ocupado = data?.espacioOcupado ?? null;
  const disponible = data?.espacioDisponible ?? null;
  const potenciaKwp = data?.potenciaPicoKwp ?? null;
  const priAnios = data?.priAnios ?? null;
  const precioKw = data?.precioPorKwConIva ?? null;
  const precioFinal = data?.precioFinalConIva ?? null;
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
      <span className="whitespace-nowrap">
        {potenciaKwp == null ? "Potencia —" : `Potencia ${potenciaKwp.toLocaleString("es-UY", { maximumFractionDigits: 2 })} kWp`}
      </span>
      <span className="whitespace-nowrap">
        {priAnios == null ? "Retorno —" : `Retorno ${priAnios.toLocaleString("es-UY", { maximumFractionDigits: 1 })} años`}
      </span>
      <span className="whitespace-nowrap">
        {precioKw == null ? "US$/kW —" : `US$ ${precioKw.toLocaleString("es-UY")}/kW c/IVA`}
      </span>
      <span className="whitespace-nowrap font-semibold text-[var(--color-text-primary)]">
        {precioFinal == null
          ? "Precio final —"
          : `Precio final US$ ${precioFinal.toLocaleString("es-UY")} c/IVA`}
      </span>
    </div>
  );
}
