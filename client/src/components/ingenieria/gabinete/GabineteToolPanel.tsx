import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Box, FileText, Plus, Trash2 } from "lucide-react";
import {
  createGabinete,
  deleteGabinete,
  getGabinete,
  getGabinetes,
  GABINETE_DEFAULTS,
} from "../../../api/gabinete.api";
import { usePermission } from "../../../hooks/usePermission";
import { GabineteBuilder } from "./GabineteBuilder";

// Panel de la herramienta "Gabinete metálico" dentro del workspace de
// Ingeniería. Lista los gabinetes del proyecto y abre el constructor.

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

export function GabineteToolPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const canEdit = usePermission("INGENIERIA", "EDIT");
  const canDelete = usePermission("INGENIERIA", "DELETE");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: gabinetes = [], isLoading } = useQuery({
    queryKey: ["gabinetes", projectId],
    queryFn: () => getGabinetes(projectId),
  });

  const { data: detalle } = useQuery({
    queryKey: ["gabinete", openId],
    queryFn: () => getGabinete(openId!),
    enabled: !!openId,
  });

  const createMut = useMutation({
    mutationFn: () => createGabinete(projectId, GABINETE_DEFAULTS),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["gabinetes", projectId] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
      setOpenId(g.id);
    },
    onError: () => toast.error("No se pudo crear el gabinete"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGabinete(id),
    onSuccess: () => {
      toast.success("Gabinete eliminado");
      qc.invalidateQueries({ queryKey: ["gabinetes", projectId] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  if (openId && detalle) {
    return <GabineteBuilder gabinete={detalle} projectId={projectId} onClose={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Diseñá el gabinete con sus medidas y emitile al fabricante una lámina con las vistas acotadas.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo gabinete
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">Cargando…</p>
      ) : gabinetes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-text-muted)]">
          Todavía no hay gabinetes en este proyecto.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {gabinetes.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5"
            >
              <Box className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text-primary)] truncate">{g.nombre}</p>
                <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  {g.anchoCm} × {g.altoCm} × {g.profundidadCm} cm · chapa {g.espesorMm} mm · {g.cantidad}{" "}
                  {g.cantidad === 1 ? "unidad" : "unidades"}
                  {g.ultimaVersion
                    ? ` · lámina v${g.ultimaVersion.versionNumber} del ${fechaCorta(g.ultimaVersion.createdAt)}`
                    : " · sin lámina emitida"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(g.id)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
              >
                <FileText className="w-3.5 h-3.5" /> {canEdit ? "Abrir" : "Ver"}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`¿Eliminar el gabinete "${g.nombre}"? Las láminas ya emitidas quedan en Documentos.`)) {
                      deleteMut.mutate(g.id);
                    }
                  }}
                  className="shrink-0 p-1.5 rounded hover:bg-red-500/15 text-red-400"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
