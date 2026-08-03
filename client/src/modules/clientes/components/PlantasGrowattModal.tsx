import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import { usePermission } from "../../../hooks/usePermission";
import { LargeModal } from "../../../components/ui/LargeModal";
import { Spinner } from "../../../components/ui/Spinner";
import {
  getPlantasGrowatt,
  sincronizarPlantas,
  vincularPlanta,
  type PlantaGrowattRow,
} from "../../../api/reportesFv.api";

// Vinculación de plantas Growatt con proyectos. El plantId es la clave real; el
// matching por nombre es sólo sugerencia. Una planta que no es de un cliente se
// marca "ignorada" para que no aparezca como pendiente.
export function PlantasGrowattModal({ onClose }: { onClose: () => void }) {
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"pendientes" | "vinculadas" | "todas">("pendientes");

  const { data: plantas = [], isLoading } = useQuery({
    queryKey: ["reportes-fv", "growatt-plantas"],
    queryFn: getPlantasGrowatt,
  });

  const sincronizar = useMutation({
    mutationFn: sincronizarPlantas,
    onSuccess: (r) => {
      toast.success(`${r.total} plantas · ${r.nuevas} nuevas`);
      qc.invalidateQueries({ queryKey: ["reportes-fv", "growatt-plantas"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo sincronizar"),
  });

  const vincular = useMutation({
    mutationFn: (v: { plantId: string; projectId: string | null; ignorada?: boolean }) =>
      vincularPlanta(v.plantId, { projectId: v.projectId, ignorada: v.ignorada }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reportes-fv", "growatt-plantas"] });
      qc.invalidateQueries({ queryKey: ["reportes-fv", "panel"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo vincular"),
  });

  const visibles = useMemo(() => {
    if (filtro === "vinculadas") return plantas.filter((p) => p.projectId);
    if (filtro === "pendientes") return plantas.filter((p) => !p.projectId && !p.ignorada);
    return plantas;
  }, [plantas, filtro]);

  const pendientes = plantas.filter((p) => !p.projectId && !p.ignorada).length;

  return (
    <LargeModal open onClose={onClose} size="wide" ariaLabel="Plantas Growatt">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
            Plantas Growatt
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {plantas.length} plantas · {pendientes} sin vincular
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            disabled={sincronizar.isPending}
            onClick={() => sincronizar.mutate()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
          >
            <RefreshCw size={14} className={sincronizar.isPending ? "animate-spin" : ""} />
            Sincronizar con Growatt
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-[var(--color-border)] px-5">
        {([
          ["pendientes", `Sin vincular (${pendientes})`],
          ["vinculadas", "Vinculadas"],
          ["todas", "Todas"],
        ] as [typeof filtro, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`border-b-2 px-3 py-2 text-sm ${
              filtro === f
                ? "border-[var(--color-accent)] font-medium text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-5">
        {isLoading ? (
          <Spinner />
        ) : visibles.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">Nada para mostrar en este filtro.</p>
        ) : (
          <div className="space-y-1.5">
            {visibles.map((p) => (
              <PlantaRow key={p.plantId} planta={p} canEdit={canEdit} onVincular={vincular.mutate} />
            ))}
          </div>
        )}
      </div>
    </LargeModal>
  );
}

function PlantaRow({
  planta,
  canEdit,
  onVincular,
}: {
  planta: PlantaGrowattRow;
  canEdit: boolean;
  onVincular: (v: { plantId: string; projectId: string | null; ignorada?: boolean }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2">
      <div className="min-w-[160px] flex-1">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{planta.name}</div>
        <div className="font-mono text-[10px] text-[var(--color-text-muted)]">
          ID {planta.plantId}
          {planta.peakPowerKw != null ? ` · ${planta.peakPowerKw} kW` : ""}
        </div>
      </div>

      {planta.projectId ? (
        <div className="flex items-center gap-2">
          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
            → {planta.projectName}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => onVincular({ plantId: planta.plantId, projectId: null })}
              className="text-xs text-[var(--color-text-muted)] hover:text-red-400"
            >
              desvincular
            </button>
          )}
        </div>
      ) : planta.ignorada ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">ignorada</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => onVincular({ plantId: planta.plantId, projectId: null, ignorada: false })}
              className="text-xs text-[var(--color-accent)]"
            >
              reactivar
            </button>
          )}
        </div>
      ) : (
        canEdit && (
          <div className="flex items-center gap-1.5">
            {planta.sugerencias.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onVincular({ plantId: planta.plantId, projectId: s.id })}
                className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-2 py-1 text-xs text-[var(--color-accent)]"
              >
                {s.clientName}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onVincular({ plantId: planta.plantId, projectId: null, ignorada: true })}
              className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
            >
              Ignorar
            </button>
          </div>
        )
      )}
    </div>
  );
}
