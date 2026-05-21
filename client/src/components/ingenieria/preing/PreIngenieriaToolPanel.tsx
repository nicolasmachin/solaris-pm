import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Eye, FileText, History, Plus, Trash2 } from "lucide-react";
import {
  deletePreIngenieriaVersion,
  getPreIngenieriaVersions,
  type PreIngenieriaVersionListItem,
} from "../../../api/preingenieria.api";
import { getProject } from "../../../api/projects.api";
import { getApiErr } from "./shared";
import { PreIngenieriaFormModal } from "./PreIngenieriaFormModal";
import { PreIngenieriaHistoryModal } from "./PreIngenieriaHistoryModal";
import { PreIngenieriaPreviewModal } from "./PreIngenieriaPreviewModal";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

export function PreIngenieriaToolPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<{ id: string; versionNumber?: number } | null>(
    null,
  );

  const versionsQ = useQuery({
    queryKey: ["preingenieria-versions", projectId],
    queryFn: () => getPreIngenieriaVersions(projectId),
  });

  function findVersionNumber(id: string): number | undefined {
    return versionsQ.data?.find((v) => v.id === id)?.versionNumber;
  }

  // Datos del proyecto para pre-rellenar el modal cuando se abre.
  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: formOpen,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePreIngenieriaVersion(id),
    onSuccess: () => {
      toast.success("Versión eliminada");
      qc.invalidateQueries({ queryKey: ["preingenieria-versions", projectId] });
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo eliminar"),
  });

  function handleDelete(id: string) {
    if (confirm("¿Eliminar esta versión? Esta acción no se puede deshacer.")) {
      deleteMut.mutate(id);
    }
  }

  function handlePreview(id: string) {
    setPreviewVersion({ id, versionNumber: findVersionNumber(id) });
  }

  const all = versionsQ.data ?? [];
  const lastThree = all.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Resumen Técnico del proyecto. Cada versión genera un PDF que se guarda en Documentos.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {all.length > 3 && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <History className="w-3 h-3" /> Historial completo ({all.length})
            </button>
          )}
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90"
          >
            <Plus className="w-3 h-3" /> Nueva versión
          </button>
        </div>
      </div>

      {versionsQ.isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : all.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
          Sin versiones todavía. Tocá "Nueva versión" para generar la primera pre-ingeniería.
        </p>
      ) : (
        <VersionList versions={lastThree} onPreview={handlePreview} onDelete={handleDelete} />
      )}

      {formOpen && projectQ.data && (
        <PreIngenieriaFormModal
          projectId={projectId}
          defaults={{
            clientName: projectQ.data.clientName,
            clientAddress: projectQ.data.clientAddress ?? null,
            locationCity: projectQ.data.locationCity ?? null,
            locationProvince: projectQ.data.locationProvince ?? null,
            clientPhone: projectQ.data.clientPhone ?? null,
          }}
          onClose={() => setFormOpen(false)}
          onSuccess={() => setFormOpen(false)}
        />
      )}

      {historyOpen && (
        <PreIngenieriaHistoryModal
          versions={all}
          onClose={() => setHistoryOpen(false)}
          onPreview={handlePreview}
          onDelete={(id) => {
            handleDelete(id);
            if (all.length <= 1) setHistoryOpen(false);
          }}
        />
      )}

      {previewVersion && (
        <PreIngenieriaPreviewModal
          versionId={previewVersion.id}
          versionNumber={previewVersion.versionNumber}
          onClose={() => setPreviewVersion(null)}
        />
      )}
    </div>
  );
}

function VersionList({
  versions,
  onPreview,
  onDelete,
}: {
  versions: PreIngenieriaVersionListItem[];
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {versions.map((v) => (
        <li
          key={v.id}
          className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2"
        >
          <FileText className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--color-text-primary)]">
              <span className="font-mono">v{v.versionNumber}</span>
              {v.label && (
                <span className="text-[var(--color-text-muted)]"> · {v.label}</span>
              )}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
              {fmt(v.createdAt)}
            </p>
          </div>
          <button
            onClick={() => onPreview(v.id)}
            className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:bg-[var(--color-bg-card-hover)]"
            title="Ver vista previa"
          >
            <Eye className="w-3 h-3" /> Ver
          </button>
          <button
            onClick={() => onDelete(v.id)}
            className="p-1 rounded hover:bg-red-500/20 text-red-400"
            title="Eliminar"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
