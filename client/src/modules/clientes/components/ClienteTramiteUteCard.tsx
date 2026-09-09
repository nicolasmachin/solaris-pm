import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, FileCheck } from "lucide-react";

import { getClienteUte } from "../../../api/clientes.api";
import { UteTimeline } from "../../../components/ute/UteTimeline";
import { Spinner } from "../../../components/ui/Spinner";
import { UTE_STAGE_LABELS } from "../constants";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * El trámite UTE del cliente, con **el mismo detalle que él ve en su portal**.
 *
 * Antes esta tarjeta mostraba sólo la etapa actual y desde cuándo, y el detalle
 * vivía únicamente del lado del cliente. Eso dejaba a Experiencia Solar
 * respondiendo de memoria sobre una pantalla que no podía ver: si el cliente
 * llamaba preguntando por un hito, había que ir a buscarlo a otro módulo.
 *
 * El timeline se pide aparte de la ficha y sólo al abrirlo: son diez hitos que no
 * se miran en cada visita.
 */
export function ClienteTramiteUteCard({
  projectId,
  tramiteUte,
}: {
  projectId: string;
  tramiteUte: { etapa: string; desde: string | null } | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-ute", projectId],
    queryFn: () => getClienteUte(projectId),
    enabled: abierto && Boolean(projectId),
  });

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={!tramiteUte}
        className="flex w-full items-center gap-2 px-4 py-3 text-left disabled:cursor-default"
      >
        <FileCheck className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">Trámite UTE</span>
        {tramiteUte ? (
          <>
            <span className="truncate text-[12px] text-[var(--color-text-secondary)]">
              {UTE_STAGE_LABELS[tramiteUte.etapa] ?? tramiteUte.etapa}
            </span>
            <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
              desde {fmtDate(tramiteUte.desde)}
            </span>
            <ChevronDown
              className={`ml-auto h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${
                abierto ? "rotate-180" : ""
              }`}
            />
          </>
        ) : (
          <span className="text-[12px] text-[var(--color-text-muted)]">Sin trámite registrado</span>
        )}
      </button>

      {abierto && tramiteUte && (
        <div className="border-t border-[var(--color-border)] p-4">
          <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
            Esto es exactamente lo que el cliente ve en su portal.
          </p>
          {isLoading || !data ? (
            <div className="flex justify-center py-6">
              <Spinner size={18} />
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {data.caseNumber && (
                  <code className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text-primary)]">
                    {data.caseNumber}
                  </code>
                )}
                {data.finalizedAt && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Finalizado el {fmtDate(data.finalizedAt)}
                  </span>
                )}
              </div>
              <UteTimeline items={data.timeline} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
