import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, Check } from "lucide-react";

import { getChecks, patchCheck, type RecorridoCheck } from "../../../api/clientes.api";
import { Spinner } from "../../../components/ui/Spinner";
import { usePermission } from "../../../hooks/usePermission";

const BLOQUES: Array<{ codigo: string; label: string }> = [
  { codigo: "E1", label: "E1 · De la venta a la obra" },
  { codigo: "E2", label: "E2 · De la obra a la habilitación" },
  { codigo: "E3", label: "E3 · Post-habilitación" },
];

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
}

function Fila({ c, canEdit, onToggle, pending }: {
  c: RecorridoCheck;
  canEdit: boolean;
  onToggle: () => void;
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

export function RecorridoChecks({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");

  const { data: checks, isLoading } = useQuery({
    queryKey: ["cliente-checks", projectId],
    queryFn: () => getChecks(projectId),
  });

  const toggle = useMutation({
    mutationFn: ({ id, completado }: { id: string; completado: boolean }) => patchCheck(id, completado),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-checks", projectId] });
      qc.invalidateQueries({ queryKey: ["recorrido"] });
    },
    onError: () => toast.error("No se pudo actualizar el paso"),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner size={20} /></div>;
  if (!checks || checks.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Sin pasos para este cliente.</p>;
  }

  const pendientesConPlazo = checks.filter((c) => !c.completado && c.vencido).length;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Los pasos de acompañamiento de este cliente. Los plazos arrancan cuando pasa el hecho que los
        dispara —se confirma la fecha de obra, UTE habilita—, y <strong>vencer no frena la obra</strong>.
        {pendientesConPlazo > 0 && (
          <span className="ml-1 font-medium text-[var(--color-danger-text)]">
            {pendientesConPlazo} vencido{pendientesConPlazo === 1 ? "" : "s"}.
          </span>
        )}
      </p>

      {BLOQUES.map((b) => {
        const delBloque = checks.filter((c) => c.recorrido === b.codigo);
        if (delBloque.length === 0) return null;
        const hechos = delBloque.filter((c) => c.completado).length;
        return (
          <section key={b.codigo}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h4 className="text-[12px] font-semibold text-[var(--color-text-primary)]">{b.label}</h4>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {hechos}/{delBloque.length}
              </span>
            </div>
            <ul className="space-y-1.5">
              {delBloque.map((c) => (
                <Fila
                  key={c.id}
                  c={c}
                  canEdit={canEdit}
                  pending={toggle.isPending}
                  onToggle={() => toggle.mutate({ id: c.id, completado: !c.completado })}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
