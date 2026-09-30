import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { FileCheck, Plus } from "lucide-react";
import {
  UTE_STAGE_LABEL,
  UTE_STATUS_LABEL,
  createUteProcess,
  getUteProcess,
  type UteProcess,
} from "../../api/uteProcess.api";
import { getSuministros } from "../../api/projects.api";
import { Button } from "../ui/Button";
import { STAGE_BADGE_COLORS, STATUS_BADGE_COLORS, UteProcessDetail } from "./UteProcessDetail";

/**
 * Contenido de la pestaña UTE dentro de ProjectDetail. Si el proyecto no
 * tiene trámite (caso raro para proyectos nuevos, ya que se crea
 * automáticamente), ofrece un botón para iniciarlo.
 */
export function UteProjectTab({
  projectId,
  uteProcess,
  canCreate,
  onChanged,
}: {
  projectId: string;
  uteProcess: UteProcess | null;
  canCreate: boolean;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  // Varios suministros (una cuenta UTE por inversor): un trámite por cada uno.
  // Se elige cuál ver; el principal es el que viene con el proyecto.
  const varios = (uteProcess?.suministrosTotal ?? 1) > 1;
  const [elegido, setElegido] = useState<string | null>(null);
  const suministrosQ = useQuery({
    queryKey: ["suministros", projectId],
    queryFn: () => getSuministros(projectId),
    enabled: varios,
  });
  const otroQ = useQuery({
    queryKey: ["ute-process", elegido],
    queryFn: () => getUteProcess(elegido!),
    enabled: !!elegido && elegido !== uteProcess?.id,
  });

  const create = useMutation({
    mutationFn: () => createUteProcess({ projectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["ute-processes"] });
      toast.success("Trámite UTE iniciado");
      onChanged?.();
    },
    onError: () => toast.error("No se pudo iniciar el trámite"),
  });

  if (!uteProcess) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)]/30 py-10 text-center">
        <FileCheck size={28} className="text-[var(--color-text-muted)]" />
        <p className="mt-3 font-display text-base font-semibold text-[var(--color-text-primary)]">
          Este proyecto no tiene trámite UTE asociado
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Creá el trámite para empezar a registrar envíos y aprobaciones de UTE.
        </p>
        {canCreate ? (
          <Button onClick={() => create.mutate()} loading={create.isPending} size="sm" className="mt-4">
            <Plus size={14} />
            Iniciar trámite UTE
          </Button>
        ) : null}
      </div>
    );
  }

  const tramites = (suministrosQ.data ?? []).filter((s) => s.uteProcessId);
  const actual: UteProcess = elegido && elegido !== uteProcess.id && otroQ.data ? otroQ.data : uteProcess;
  const actualId = elegido ?? uteProcess.id;

  return (
    <div>
      {varios && (
        <div className="mb-3">
          <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
            Este proyecto tiene <b>{uteProcess.suministrosTotal} suministros</b>, cada uno con su trámite. La obra queda habilitada
            cuando terminan todos.
          </p>
          <div className="flex flex-wrap gap-2">
            {tramites.map((s) => (
              <button
                key={s.numero}
                onClick={() => setElegido(s.uteProcessId)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  s.uteProcessId === actualId
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/60"
                }`}
              >
                <b>Suministro {s.numero}</b>
                {s.cuentaUte ? ` · Cta ${s.cuentaUte}` : ""}
                {s.inversor ? ` · ${s.inversor}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: STAGE_BADGE_COLORS[actual.currentStage].bg,
            color: STAGE_BADGE_COLORS[actual.currentStage].text,
          }}
        >
          {UTE_STAGE_LABEL[actual.currentStage]}
        </span>
        <span
          className="rounded px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: STATUS_BADGE_COLORS[actual.currentStatus].bg,
            color: STATUS_BADGE_COLORS[actual.currentStatus].text,
          }}
        >
          {UTE_STATUS_LABEL[actual.currentStatus]}
        </span>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/40">
        <UteProcessDetail key={actual.id} process={actual} />
      </div>
    </div>
  );
}
