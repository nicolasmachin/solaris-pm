import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, Check, MessageSquare } from "lucide-react";

import { patchCheck, type ClienteRecorrido, type RecorridoCheck } from "../../../api/clientes.api";
import { usePermission } from "../../../hooks/usePermission";
import { plantillaDeCheck } from "../plantillas";
import { PlantillasModal } from "./PlantillasModal";
import { BLOQUES } from "./RecorridoPipeline";

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
}

function Fila({ c, canEdit, onToggle, onVerMensaje, pending }: {
  c: RecorridoCheck;
  canEdit: boolean;
  onToggle: () => void;
  /** null = este paso no tiene mensaje modelo. */
  onVerMensaje: (() => void) | null;
  pending: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 ${
        c.vencido
          ? "border-[var(--color-danger-text)]/40 bg-[var(--color-danger-bg)]/25"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
      }`}
    >
      <button
        type="button"
        disabled={!canEdit || pending}
        onClick={onToggle}
        aria-label={c.completado ? `Reabrir: ${c.titulo}` : `Completar: ${c.titulo}`}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          c.completado
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
            : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
        } ${canEdit ? "cursor-pointer" : "cursor-default opacity-60"}`}
      >
        {c.completado && <Check className="h-3 w-3 text-[var(--color-bg-app)]" />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] ${
            c.completado
              ? "text-[var(--color-text-muted)] line-through"
              : "font-medium text-[var(--color-text-primary)]"
          }`}
        >
          {c.titulo}
        </p>
        {c.nota && <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{c.nota}</p>}
        {!c.completado && c.detalle && (
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{c.detalle}</p>
        )}
        {c.completado && c.completadoPor && (
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {c.completadoPor} · {fmt(c.completadoEn)}
          </p>
        )}
      </div>

      {/* El mensaje modelo del paso, a un clic. Se ofrece aunque el paso ya esté
          hecho: puede hacer falta repetirlo. */}
      {onVerMensaje && (
        <button
          type="button"
          onClick={onVerMensaje}
          title="Ver el mensaje modelo de este paso"
          className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      )}

      {/* El plazo solo se muestra mientras está pendiente: uno completado tarde
          ya no es un pendiente. */}
      {!c.completado && c.venceEn && (
        <span
          className={`shrink-0 whitespace-nowrap text-[11px] ${
            c.vencido
              ? "font-semibold text-[var(--color-danger-text)]"
              : "text-[var(--color-text-muted)]"
          }`}
        >
          {c.vencido && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
          {c.vencido ? "venció" : "vence"} {fmt(c.venceEn)}
        </span>
      )}
    </li>
  );
}

/**
 * Los pasos de UNA etapa del recorrido. La etapa la elige el pipeline de arriba:
 * mostrar las tres a la vez obligaba a scrollear para llegar a lo de hoy.
 */
export function RecorridoChecks({
  projectId,
  cliente,
  recorrido,
  checks,
}: {
  projectId: string;
  cliente: string;
  recorrido: ClienteRecorrido;
  checks: RecorridoCheck[];
}) {
  const qc = useQueryClient();
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const [plantillaAbierta, setPlantillaAbierta] = useState<{ id?: string } | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, completado }: { id: string; completado: boolean }) => patchCheck(id, completado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-checks", projectId] });
      qc.invalidateQueries({ queryKey: ["recorrido"] });
    },
    onError: () => toast.error("No se pudo actualizar el paso"),
  });

  const bloque = BLOQUES.find((b) => b.codigo === recorrido);
  const delBloque = checks.filter((c) => c.recorrido === recorrido);
  const hechos = delBloque.filter((c) => c.completado).length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            {recorrido} · {bloque?.largo}
          </h3>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {hechos} de {delBloque.length} pasos · vencer no frena la obra
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPlantillaAbierta({})}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
        >
          <MessageSquare className="h-3 w-3" />
          Plantillas
        </button>
      </div>

      {delBloque.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--color-text-muted)]">
          Esta etapa no tiene pasos cargados.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {delBloque.map((c) => {
            const plantilla = plantillaDeCheck(c.codigo);
            return (
              <Fila
                key={c.id}
                c={c}
                canEdit={canEdit}
                pending={toggle.isPending}
                onToggle={() => toggle.mutate({ id: c.id, completado: !c.completado })}
                onVerMensaje={plantilla ? () => setPlantillaAbierta({ id: plantilla.id }) : null}
              />
            );
          })}
        </ul>
      )}

      {plantillaAbierta && (
        <PlantillasModal
          projectId={projectId}
          cliente={cliente}
          recorrido={recorrido}
          plantillaInicial={plantillaAbierta.id}
          onClose={() => setPlantillaAbierta(null)}
        />
      )}
    </div>
  );
}
