import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";

import {
  deleteLeadAttachment,
  leadAttachmentDownloadUrl,
  listLeadAttachments,
  uploadLeadAttachment,
  type LeadAttachment,
} from "../../api/leads.api";
import { ConfirmDialog } from "../ui/ConfirmDialog";

// Whitelist alineada con el server (Tanda 1): PDF, imágenes, Word, Excel. 10 MB.
const LEAD_ATTACH_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";
const LEAD_ATTACH_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"];
const LEAD_ATTACH_MAX_MB = 10;

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("voltia-token");
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function LeadAttachments({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadAttachment | null>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["lead-attachments", leadId],
    queryFn: () => listLeadAttachments(leadId),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadLeadAttachment(leadId, file),
    onSuccess: () => {
      toast.success("Archivo subido");
      qc.invalidateQueries({ queryKey: ["lead-attachments", leadId] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo subir el archivo");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (attachmentId: string) => deleteLeadAttachment(leadId, attachmentId),
    onSuccess: () => {
      toast.success("Archivo eliminado");
      qc.invalidateQueries({ queryKey: ["lead-attachments", leadId] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    // Validación en cliente (el server re-valida, autoritativo).
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!LEAD_ATTACH_EXTS.includes(ext)) {
      toast.error("Tipo de archivo no soportado. Se permiten: PDF, JPG, PNG, Word, Excel.");
      return;
    }
    if (file.size > LEAD_ATTACH_MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera el límite de ${LEAD_ATTACH_MAX_MB} MB.`);
      return;
    }

    setUploading(true);
    uploadMut.mutate(file, { onSettled: () => setUploading(false) });
  }

  function handleDownload(att: LeadAttachment) {
    downloadWithAuth(leadAttachmentDownloadUrl(leadId, att.id), att.filename).catch(() =>
      toast.error("No se pudo descargar"),
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Calculadoras de cotización, propuestas, minutas y otros archivos del lead. Cuando el lead
          se convierte en proyecto, todos estos adjuntos se copian al proyecto.
        </p>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              hidden
              accept={LEAD_ATTACH_ACCEPT}
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60 shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Subiendo…" : "Subir archivo"}
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-4">Cargando…</p>
      ) : attachments.length === 0 ? (
        <div className="border border-dashed border-[var(--color-border)] rounded-lg py-6 text-center text-xs text-[var(--color-text-muted)]">
          <Paperclip className="w-4 h-4 mx-auto mb-1.5 opacity-50" />
          No hay archivos adjuntos.
          {canEdit && " Subí el primero con el botón de arriba."}
        </div>
      ) : (
        <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-bg-app)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Archivo</th>
                <th className="text-left px-3 py-2 font-medium">Subido por</th>
                <th className="text-left px-3 py-2 font-medium">Fecha</th>
                <th className="text-right px-3 py-2 font-medium w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {attachments.map((a) => (
                <tr key={a.id} className="hover:bg-[var(--color-bg-card-hover)]">
                  <td className="px-3 py-2">
                    <p className="text-[var(--color-text-primary)] truncate max-w-[260px]" title={a.filename}>
                      {a.filename}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">{fmtSize(a.sizeBytes)}</p>
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {a.uploadedBy?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">{fmtDate(a.createdAt)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleDownload(a)}
                      title="Descargar"
                      className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] p-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => setDeleteTarget(a)}
                        disabled={deleteMut.isPending}
                        title="Eliminar"
                        className="text-[var(--color-text-muted)] hover:text-red-400 p-1 ml-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Borrar adjunto"
        description={
          deleteTarget ? `¿Borrar ${deleteTarget.filename}? Esta acción no se puede deshacer.` : ""
        }
        confirmLabel="Borrar"
        destructive
        loading={deleteMut.isPending}
      />
    </div>
  );
}
