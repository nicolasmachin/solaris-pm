import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { FileCheck, Plus } from "lucide-react";
import {
  UTE_STAGE_LABEL,
  UTE_STATUS_LABEL,
  createUteProcess,
  type UteProcess,
} from "../../api/uteProcess.api";
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: STAGE_BADGE_COLORS[uteProcess.currentStage].bg,
            color: STAGE_BADGE_COLORS[uteProcess.currentStage].text,
          }}
        >
          {UTE_STAGE_LABEL[uteProcess.currentStage]}
        </span>
        <span
          className="rounded px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: STATUS_BADGE_COLORS[uteProcess.currentStatus].bg,
            color: STATUS_BADGE_COLORS[uteProcess.currentStatus].text,
          }}
        >
          {UTE_STATUS_LABEL[uteProcess.currentStatus]}
        </span>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/40">
        <UteProcessDetail process={uteProcess} />
      </div>
    </div>
  );
}
