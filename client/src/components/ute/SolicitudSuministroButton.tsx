import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getEstadoSuministro } from "../../api/uteSuministro.api";
import {
  COMERCIAL_COLOR,
  ESTADO_COMERCIAL_COLORS,
  ESTADO_COMERCIAL_LABEL,
  TIPO_COMERCIAL_LABEL,
} from "../../api/uteComercial.api";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Columna de solo día (medianoche UTC): se lee en UTC.
function fmtDia(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getUTCDate()}-${MONTHS_ES[d.getUTCMonth()]}`;
}

/**
 * Acceso a los trámites OPCIONALES con UTE Comercial (aumento de potencia,
 * suministro nuevo…) desde la subetapa "Consulta inicial UTE" de Onboarding.
 *
 * Se muestra siempre (no sabemos de antemano qué suministros necesitan algo),
 * con estilo secundario para que se lea como el camino alternativo que es.
 * Lista los trámites que ya tiene el proyecto —puede tener varios— y deja
 * pedir otro. Se siguen en Trámites UTE → Comercial.
 */
export function SolicitudSuministroButton({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["suministro-individual-estado", projectId],
    queryFn: () => getEstadoSuministro(projectId),
    enabled: !!projectId,
  });
  const tramites = data?.tramites ?? [];

  return (
    <div className="mb-3">
      {tramites.length > 0 && (
        <button
          type="button"
          onClick={() => navigate("/tramites-ute?seccion=comercial")}
          className="mb-1.5 w-full rounded-lg border px-3 py-2 text-left hover:bg-[var(--color-bg-app)]"
          style={{ borderColor: `${COMERCIAL_COLOR}55` }}
          title="Ver en Trámites UTE → Comercial"
        >
          {tramites.map((t) => {
            const c = ESTADO_COMERCIAL_COLORS[t.estado];
            return (
              <div key={t.id} className="flex items-center gap-2 py-0.5 text-xs">
                <span className="font-semibold" style={{ color: COMERCIAL_COLOR }}>
                  {TIPO_COMERCIAL_LABEL[t.tipo]}
                </span>
                {t.detalle ? <span className="text-[var(--color-text-secondary)]">{t.detalle}</span> : null}
                <span className="flex-1" />
                {t.solicitadoEl ? (
                  <span className="text-[10px] text-[var(--color-text-muted)]">{fmtDia(t.solicitadoEl)}</span>
                ) : null}
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: c.bg, color: c.text }}
                >
                  {ESTADO_COMERCIAL_LABEL[t.estado]}
                </span>
              </div>
            );
          })}
        </button>
      )}
      <button
        type="button"
        onClick={() => navigate(`/proyecto/${projectId}/suministro-individual`)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-app)]"
      >
        ⚡ {tramites.length > 0 ? "Pedir otro trámite a UTE Comercial" : "Solicitar aumento de potencia u otro trámite comercial"}
      </button>
    </div>
  );
}
