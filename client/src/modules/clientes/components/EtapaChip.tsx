import type { ClienteRecorrido, EtapaInfo } from "../../../api/clientes.api";

// Cada etapa del recorrido con su color, para distinguirlas de un vistazo:
//   E1 (pre-obra) azul · E2 (habilitación, mayor fricción) ámbar · E3 (postventa) verde.
const RECORRIDO_COLOR: Record<ClienteRecorrido, string> = {
  E1: "bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
  E2: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
  E3: "bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]",
};

// Chip de etapa en dos niveles:
//   - Recorrido (código + nombre corto, con color por etapa), tooltip = nombre largo.
//   - Sub-etapa del pipeline en curso (subtexto debajo).
export function EtapaChip({ etapa }: { etapa: EtapaInfo | null }) {
  if (!etapa) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <div className="inline-flex flex-col leading-tight" title={etapa.recorrido.nombreLargo}>
      <span
        className={`inline-flex items-center self-start rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${RECORRIDO_COLOR[etapa.recorrido.codigo]}`}
      >
        {etapa.recorrido.codigo} · {etapa.recorrido.nombreCorto}
      </span>
      <span className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{etapa.pipeline.label}</span>
    </div>
  );
}
