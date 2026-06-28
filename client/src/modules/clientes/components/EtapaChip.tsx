import type { EtapaInfo } from "../../../api/clientes.api";

// Chip de etapa en dos niveles:
//   - Recorrido (código + nombre corto, con color), tooltip = nombre largo.
//   - Sub-etapa del pipeline en curso (subtexto debajo).
export function EtapaChip({ etapa }: { etapa: EtapaInfo | null }) {
  if (!etapa) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <div className="inline-flex flex-col leading-tight" title={etapa.recorrido.nombreLargo}>
      <span className="inline-flex items-center self-start rounded bg-[var(--color-info-bg)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--color-info-text)]">
        {etapa.recorrido.codigo} · {etapa.recorrido.nombreCorto}
      </span>
      <span className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{etapa.pipeline.label}</span>
    </div>
  );
}
