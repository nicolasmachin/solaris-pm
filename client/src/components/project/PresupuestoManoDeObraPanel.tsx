import { useQuery } from "@tanstack/react-query";

import { getPresupuestoManoDeObra } from "../../api/pagosInstalador.api";

/**
 * El panel de la subetapa "Presupuesto al instalador tercerizado" (Validación de
 * Operaciones): el monto que el gerente de Operaciones le informa al
 * tercerizado antes de agendar la obra. Antes no había de dónde sacarlo: el
 * pago al instalador recién aparece cuando la obra ya está agendada.
 *
 * El gerente no tiene margen para negociar: si el instalador no acepta, se
 * consulta con Gerencia.
 */
export function PresupuestoManoDeObraPanel({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["mano-de-obra", projectId],
    queryFn: () => getPresupuestoManoDeObra(projectId),
  });

  return (
    <div className="mb-3 rounded-lg border border-[var(--color-border)] p-3">
      <p className="mb-1 text-xs font-semibold text-[var(--color-text-primary)]">
        Presupuesto de mano de obra
      </p>

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-secondary)]">Cargando…</p>
      ) : data?.montoUsd != null ? (
        <>
          <p className="text-lg font-semibold text-[var(--color-text-primary)]">
            USD {data.montoUsd.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="ml-1 text-xs font-normal text-[var(--color-text-secondary)]">IVA incluido</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
            {data.origen === "PAGO"
              ? "Es el monto del pago al instalador, que se generó al agendar la obra."
              : `De la propuesta ganadora${data.versionNumber ? ` (versión ${data.versionNumber})` : ""}.`}
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Este proyecto no tiene una propuesta con mano de obra. El monto se consulta con Gerencia antes de ofrecerlo.
        </p>
      )}

      <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
        No se negocia: si el instalador no acepta, se consulta con Gerencia. Si la obra va con el equipo propio, esta
        subetapa se marca como «No aplica».
      </p>
    </div>
  );
}
