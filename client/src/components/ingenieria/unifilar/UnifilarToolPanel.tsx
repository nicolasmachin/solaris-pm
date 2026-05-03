import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { History, Plus } from "lucide-react";
import {
  deleteUnifilarVersion,
  getUnifilarVersion,
  getUnifilarVersions,
  type UnifilarFormInput,
} from "../../../api/unifilar.api";
import { fromVersionAsForm, getApiErr } from "./shared";
import { UnifilarFormModal } from "./UnifilarFormModal";
import { UnifilarHistoryModal } from "./UnifilarHistoryModal";
import { UnifilarPreviewModal } from "./UnifilarPreviewModal";
import { UnifilarVersionsTable } from "./UnifilarVersionsTable";

/**
 * Body del accordion de la herramienta "Generador de unifilar" en el workspace
 * de Ingeniería. Muestra las 3 últimas versiones, un botón para crear una nueva
 * y otro para abrir el historial completo. Toda la generación pasa por modales.
 */
export function UnifilarToolPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState<UnifilarFormInput | null>(null);
  const [previewVersion, setPreviewVersion] = useState<{ id: string; versionNumber?: number } | null>(
    null,
  );

  const versionsQ = useQuery({
    queryKey: ["unifilar-versions", projectId],
    queryFn: () => getUnifilarVersions(projectId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteUnifilarVersion(id),
    onSuccess: () => {
      toast.success("Versión eliminada");
      qc.invalidateQueries({ queryKey: ["unifilar-versions", projectId] });
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo eliminar"),
  });

  function openCreate() {
    setDuplicateFrom(null);
    setFormOpen(true);
  }

  async function openDuplicate(versionId: string) {
    try {
      const v = await getUnifilarVersion(versionId);
      const form = fromVersionAsForm(v);
      form.label = `${v.label ?? `v${v.versionNumber}`} (copia)`;
      setDuplicateFrom(form);
      setHistoryOpen(false);
      setFormOpen(true);
    } catch {
      toast.error("No se pudo cargar la versión a duplicar");
    }
  }

  function handleDelete(id: string) {
    if (confirm("¿Eliminar esta versión? Esta acción no se puede deshacer.")) {
      deleteMut.mutate(id);
    }
  }

  function findVersionNumber(id: string): number | undefined {
    return versionsQ.data?.find((v) => v.id === id)?.versionNumber;
  }

  const all = versionsQ.data ?? [];
  const lastThree = all.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Últimas 3 versiones generadas. Para ver el historial completo o aplicar filtros, abrí el
          historial.
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
            onClick={openCreate}
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
          Sin versiones todavía. Tocá "Nueva versión" para generar el primer unifilar.
        </p>
      ) : (
        <UnifilarVersionsTable
          versions={lastThree}
          onPreview={(id) => setPreviewVersion({ id, versionNumber: findVersionNumber(id) })}
          onDuplicate={openDuplicate}
          onDelete={handleDelete}
        />
      )}

      {formOpen && (
        <UnifilarFormModal
          projectId={projectId}
          initialForm={duplicateFrom}
          onClose={() => {
            setFormOpen(false);
            setDuplicateFrom(null);
          }}
          onSuccess={(created) => {
            setFormOpen(false);
            setDuplicateFrom(null);
            toast.success(`Versión v${created.versionNumber} creada`);
            qc.invalidateQueries({ queryKey: ["unifilar-versions", projectId] });
            qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
            qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
            setPreviewVersion({ id: created.id, versionNumber: created.versionNumber });
          }}
        />
      )}

      {historyOpen && (
        <UnifilarHistoryModal
          versions={all}
          onClose={() => setHistoryOpen(false)}
          onPreview={(id) => setPreviewVersion({ id, versionNumber: findVersionNumber(id) })}
          onDuplicate={openDuplicate}
          onDelete={handleDelete}
        />
      )}

      {previewVersion && (
        <UnifilarPreviewModal
          versionId={previewVersion.id}
          versionNumber={previewVersion.versionNumber}
          onClose={() => setPreviewVersion(null)}
        />
      )}
    </div>
  );
}
