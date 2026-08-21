import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getEstadoSuministro } from "../../api/uteSuministro.api";

/**
 * Acceso al trámite OPCIONAL de aumento de potencia contratada, desde la
 * subetapa "Consulta inicial UTE" de Onboarding.
 *
 * Se muestra siempre (no sabemos de antemano qué suministros necesitan el
 * aumento), pero con estilo secundario para que se lea como el camino
 * alternativo que es. Si ya se pidió, en vez de invitar a mandarlo de nuevo
 * dice cuándo se pidió y por cuánto.
 */
export function SolicitudSuministroButton({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["suministro-individual-estado", projectId],
    queryFn: () => getEstadoSuministro(projectId),
    enabled: !!projectId,
  });

  const solicitado = data?.solicitadoEl
    ? new Date(data.solicitadoEl).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <button
      onClick={() => navigate(`/proyecto/${projectId}/suministro-individual`)}
      className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-app)]"
    >
      ⚡{" "}
      {solicitado
        ? `Aumento de potencia solicitado el ${solicitado}${
            data?.potenciaSolicitada ? ` (${data.potenciaSolicitada} kW)` : ""
          }`
        : "Solicitar aumento de potencia"}
    </button>
  );
}
