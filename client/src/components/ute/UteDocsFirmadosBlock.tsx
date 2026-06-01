import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { FileArchive, FileText, Image as ImageIcon, PenLine, Trash2 } from "lucide-react";

import {
  deleteUteDocFirmado,
  getUteDocsFirmados,
  type UteDocFile,
} from "../../api/uteDocs.api";
import { downloadAuthenticated } from "../../hooks/useAuthBlobUrl";
import { useAuthStore } from "../../store/auth.store";
import { UteDocsFirmadosUpload } from "./UteDocsFirmadosUpload";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const cls = "h-4 w-4 shrink-0 text-[var(--color-text-muted)]";
  if (mimeType.startsWith("image/")) return <ImageIcon className={cls} />;
  if (mimeType === "application/zip" || mimeType === "application/x-zip-compressed")
    return <FileArchive className={cls} />;
  return <FileText className={cls} />;
}

interface Props {
  projectId: string;
}

export function UteDocsFirmadosBlock({ projectId }: Props) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: firmados = [], isLoading } = useQuery({
    queryKey: ["ute-docs-firmados", projectId],
    queryFn: () => getUteDocsFirmados(projectId),
  });

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => deleteUteDocFirmado(projectId, fileId),
    onSuccess: () => {
      toast.success("Documento eliminado");
      qc.invalidateQueries({ queryKey: ["ute-docs-firmados", projectId] });
    },
    onError: () => toast.error("No se pudo eliminar el documento"),
  });

  function canDelete(file: UteDocFile): boolean {
    if (!user) return false;
    return user.role === "ADMIN" || file.uploadedBy?.id === user.id;
  }

  async function handleDownload(file: UteDocFile) {
    setDownloadingId(file.id);
    try {
      await downloadAuthenticated(file.downloadUrl, file.filename);
    } catch (err) {
      console.error("Error descargando documento firmado:", err);
      toast.error("No se pudo descargar el documento");
    } finally {
      setDownloadingId(null);
    }
  }

  function handleDelete(file: UteDocFile) {
    if (!confirm(`¿Eliminar "${file.filename}"?`)) return;
    deleteMut.mutate(file.id);
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PenLine className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
            Documentos UTE firmados
          </h3>
        </div>
        <UteDocsFirmadosUpload projectId={projectId} />
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : firmados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-4 text-center text-xs text-[var(--color-text-muted)]">
          Todavía no se subieron documentos firmados
        </div>
      ) : (
        <ul className="space-y-2">
          {firmados.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2"
            >
              <FileIcon mimeType={file.mimeType} />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  disabled={downloadingId === file.id}
                  className="block max-w-full truncate text-left text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline disabled:opacity-50"
                  title={`Descargar ${file.filename}`}
                >
                  {file.filename}{" "}
                  <span className="font-normal text-[var(--color-text-muted)]">
                    · {fmtSize(file.sizeBytes)}
                  </span>
                </button>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  Subido por {file.uploadedBy?.name ?? "—"} · {fmtDate(file.createdAt)}
                </p>
              </div>
              {canDelete(file) && (
                <button
                  type="button"
                  onClick={() => handleDelete(file)}
                  disabled={deleteMut.isPending}
                  aria-label="Eliminar documento"
                  className="shrink-0 rounded p-1.5 text-[var(--color-text-muted)] hover:bg-red-600/10 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
