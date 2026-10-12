import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";

import { CommentThread } from "../comments/CommentThread";
import { DocumentPreviewModal } from "../project/DocumentsStrip";
import { deleteFile, getProjectDocuments, uploadFile, type ProjectDocument } from "../../api/files.api";
import { AREA_TRABAJO_LABEL, type AreaTrabajo } from "../../types/api.types";
import { useAuthStore } from "../../store/auth.store";
import { usePermission } from "../../hooks/usePermission";

// "Comentarios y archivos" del área: el mismo bloque en la pantalla de cada
// área (Ingeniería, Tramitación UTE, …) para que cada una trabaje desde su lugar.
// Por atrás es la ficha única del proyecto: escribe en los comentarios y los
// archivos del proyecto, marcados con el área, y todo termina en la línea de
// tiempo del cliente con la etiqueta correcta.

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComentariosYArchivos({ projectId, area }: { projectId: string; area: AreaTrabajo }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const puedeBorrarTodo = usePermission("OPERACIONES", "EDIT");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [soloArea, setSoloArea] = useState(true);
  const [preview, setPreview] = useState<ProjectDocument | null>(null);

  const docsQ = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => getProjectDocuments(projectId),
  });
  const docs = (docsQ.data ?? []).filter((d) => !soloArea || d.area === area);

  async function handleUpload(file: File) {
    try {
      setUploadPct(0);
      await uploadFile(projectId, file, null, setUploadPct, area);
      toast.success("Archivo subido");
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo subir el archivo");
    } finally {
      setUploadPct(null);
    }
  }

  const borrarMut = useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onSuccess: () => {
      toast.success("Archivo borrado");
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo borrar el archivo");
    },
  });

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
          Comentarios y archivos · {AREA_TRABAJO_LABEL[area]}
        </p>
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          Lo que se anota o se sube acá queda en el proyecto y en la ficha del cliente, marcado como de{" "}
          {AREA_TRABAJO_LABEL[area]}.
        </p>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-[var(--color-text-primary)]">Comentarios del proyecto</p>
          <CommentThread projectId={projectId} level="project" area={area} />
        </div>

        <div
          className="min-w-0"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f && uploadPct === null) void handleUpload(f);
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">Archivos</p>
            <div className="ml-auto flex overflow-hidden rounded-md border border-[var(--color-border)] text-[10px]">
              {([true, false] as const).map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setSoloArea(v)}
                  className={
                    soloArea === v
                      ? "bg-[var(--color-accent)] px-2 py-1 font-semibold text-gray-900"
                      : "px-2 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                  }
                >
                  {v ? `De ${AREA_TRABAJO_LABEL[area]}` : "Todos del proyecto"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPct !== null}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-gray-900 hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              <Upload className="h-3 w-3" />
              {uploadPct !== null ? `${uploadPct}%` : "Subir"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = "";
              }}
            />
          </div>

          {docsQ.isLoading ? (
            <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Cargando…</p>
          ) : docs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] py-6 text-center text-xs text-[var(--color-text-muted)]">
              <Paperclip className="mx-auto mb-1 h-4 w-4" />
              {soloArea ? `Todavía no hay archivos de ${AREA_TRABAJO_LABEL[area]}.` : "El proyecto no tiene archivos."}
              <br />
              Se pueden arrastrar acá.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
              {docs.map((d) => {
                const puedeBorrar = puedeBorrarTodo || d.uploadedBy === user?.id;
                return (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                    <button type="button" onClick={() => setPreview(d)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-xs text-[var(--color-text-primary)] hover:underline">{d.filename}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {formatSize(d.sizeBytes)} · {formatFecha(d.uploadedAt)} · {d.sourceLabel}
                      </p>
                    </button>
                    {puedeBorrar && (
                      <button
                        type="button"
                        title="Borrar"
                        disabled={borrarMut.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Borrar "${d.filename}"?`)) borrarMut.mutate(d.id);
                        }}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)]/40 hover:text-[var(--color-danger-text)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {preview && <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
