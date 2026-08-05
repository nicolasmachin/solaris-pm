import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  Download,
  Edit2,
  FileText,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  EFP_SECTION_KEYS,
  EFP_SECTION_TITLES,
  type EFPAttachmentDto,
  type EFPSectionKey,
  type EFPStatus,
  type EFPVersionDto,
  deleteEFPAttachment,
  patchEFPAttachment,
  deleteEFPVersion,
  efpVersionPdfUrl,
  generateEFPWithAI,
  getEFP,
  snapshotEFPVersion,
  updateEFPStatus,
  updateEFPVersion,
  uploadEFPAttachment,
} from "../api/efp.api";
import { getVisitas, type VisitListItem } from "../api/visitas.api";
import { usePermission } from "../hooks/usePermission";
import { ACCEPT_FOTOS_Y_PDF } from "../utils/fileAccept";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const STATUS_LABELS: Record<EFPStatus, string> = {
  DRAFT: "Borrador",
  REVIEW: "En revisión",
  APPROVED: "Aprobado",
  ARCHIVED: "Archivado",
};

function StatusBadge({ status }: { status: EFPStatus }) {
  const tone =
    status === "APPROVED"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : status === "REVIEW"
        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
        : status === "ARCHIVED"
          ? "bg-zinc-500/20 text-zinc-300 border-zinc-500/40"
          : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${tone}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("voltia-token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
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

export function ProyectoFinal() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEditIngenieria = usePermission("INGENIERIA", "EDIT");

  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const efpQ = useQuery({
    queryKey: ["efp", projectId],
    queryFn: () => getEFP(projectId!),
    enabled: !!projectId,
  });

  const efp = efpQ.data?.efp ?? null;
  const project = efpQ.data?.project ?? null;
  const versions = efp?.versions ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ efpId, status }: { efpId: string; status: EFPStatus }) =>
      updateEFPStatus(efpId, status),
    onSuccess: ({ status }) => {
      qc.invalidateQueries({ queryKey: ["efp", projectId] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
      if (status === "APPROVED") {
        toast.success("Proyecto Final aprobado. Operaciones recibió el aviso.");
      } else {
        toast.success(`Estado actualizado a ${status}`);
      }
    },
    onError: (err) => {
      toast.error(getApiErr(err) ?? "No se pudo cambiar el estado");
    },
  });

  const currentVersion = useMemo(() => {
    if (versions.length === 0) return null;
    if (selectedVersionId) {
      const found = versions.find((v) => v.id === selectedVersionId);
      if (found) return found;
    }
    return versions[0];
  }, [versions, selectedVersionId]);

  const isLatest = !currentVersion || currentVersion.id === versions[0]?.id;
  const canEdit = !!currentVersion && isLatest;

  if (!projectId) return null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <header>
        <Link
          to={`/ingenieria/proyecto/${projectId}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al workspace de Ingeniería
        </Link>
        <div className="mt-2 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
            Proyecto Final de Ingeniería
            {efp && <StatusBadge status={efp.status} />}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            {project && (
              <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
                {project.code} · {project.clientName}
              </p>
            )}
            {efp && canEditIngenieria && efp.status !== "APPROVED" && versions.length > 0 && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "¿Aprobar el Proyecto Final? Se le va a avisar a Operaciones para que arranque la planificación de la instalación.",
                    )
                  ) {
                    statusMutation.mutate({ efpId: efp.id, status: "APPROVED" });
                  }
                }}
                disabled={statusMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {statusMutation.isPending ? "Aprobando…" : "Aprobar"}
              </button>
            )}
            {efp && canEditIngenieria && efp.status === "APPROVED" && (
              <button
                onClick={() => {
                  if (confirm("¿Volver el Proyecto Final a estado borrador?")) {
                    statusMutation.mutate({ efpId: efp.id, status: "DRAFT" });
                  }
                }}
                disabled={statusMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
              >
                Reabrir
              </button>
            )}
          </div>
        </div>
      </header>

      {efpQ.isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : efpQ.isError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          No se pudo cargar el Proyecto Final.
        </p>
      ) : !efp || versions.length === 0 ? (
        <EmptyState
          onGenerate={() => setGenerateModalOpen(true)}
          message={
            efp
              ? "El documento existe pero no tiene versiones. Generá un borrador con IA para arrancar."
              : "Aún no se generó el Proyecto Final. Empezá generando un borrador con IA."
          }
        />
      ) : (
        currentVersion && (
          <>
            <Toolbar
              versions={versions}
              currentVersion={currentVersion}
              onChangeVersion={setSelectedVersionId}
              onRegenerate={() => setGenerateModalOpen(true)}
              onSnapshot={async () => {
                try {
                  const created = await snapshotEFPVersion(efp.id);
                  toast.success(`Versión v${created.version} creada`);
                  setSelectedVersionId(created.id);
                  qc.invalidateQueries({ queryKey: ["efp", projectId] });
                  qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
                } catch (err) {
                  toast.error(getApiErr(err) ?? "No se pudo crear el snapshot");
                }
              }}
              onDownloadPdf={async () => {
                try {
                  await downloadWithAuth(
                    efpVersionPdfUrl(currentVersion.id),
                    `proyecto-final-${project?.code ?? "doc"}-v${currentVersion.version}.pdf`,
                  );
                } catch {
                  toast.error("No se pudo descargar el PDF");
                }
              }}
              onDeleteVersion={async () => {
                if (!confirm(`¿Eliminar v${currentVersion.version}? No se puede deshacer.`)) return;
                try {
                  await deleteEFPVersion(currentVersion.id);
                  toast.success("Versión eliminada");
                  setSelectedVersionId(null);
                  qc.invalidateQueries({ queryKey: ["efp", projectId] });
                  qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
                } catch (err) {
                  toast.error(getApiErr(err) ?? "No se pudo eliminar");
                }
              }}
              canDelete={versions.length > 1}
            />

            {!isLatest && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-300">
                Estás viendo una versión histórica (v{currentVersion.version}). La edición está
                deshabilitada — cambiá a la versión más reciente (v{versions[0].version}) para editar.
              </div>
            )}

            {currentVersion.changesFromPrevious && (
              <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-1">
                  Cambios respecto a la versión anterior
                </p>
                <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap">
                  {currentVersion.changesFromPrevious}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {EFP_SECTION_KEYS.map((key) => (
                <SectionEditor
                  key={key}
                  versionId={currentVersion.id}
                  sectionKey={key}
                  title={EFP_SECTION_TITLES[key]}
                  content={currentVersion.content[key] ?? ""}
                  checklist={currentVersion.checklist?.[key] ?? null}
                  canEdit={canEdit}
                  onSaved={() => {
                    qc.invalidateQueries({ queryKey: ["efp", projectId] });
                  }}
                />
              ))}
            </div>

            <AttachmentsBlock
              efpId={efp.id}
              attachments={efp.attachments}
              canEdit={canEdit}
              onChange={() => qc.invalidateQueries({ queryKey: ["efp", projectId] })}
            />

            <p className="text-[10px] text-[var(--color-text-muted)] font-mono pt-2 border-t border-[var(--color-border)]">
              v{currentVersion.version} ·{" "}
              {currentVersion.aiGenerated ? "generado con IA" : "snapshot manual"} ·{" "}
              {currentVersion.modelUsed ?? "—"} ·{" "}
              {currentVersion.tokensInput ?? 0} input + {currentVersion.tokensOutput ?? 0} output ·{" "}
              USD {currentVersion.costUsd?.toFixed(4) ?? "—"} · creado por{" "}
              {currentVersion.createdBy?.name ?? "—"} el {fmt(currentVersion.createdAt)}
            </p>
          </>
        )
      )}

      {generateModalOpen && (
        <GenerateModal
          projectId={projectId}
          onClose={() => setGenerateModalOpen(false)}
          onGenerated={(versionId) => {
            setGenerateModalOpen(false);
            setSelectedVersionId(versionId);
            qc.invalidateQueries({ queryKey: ["efp", projectId] });
            qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
            qc.invalidateQueries({ queryKey: ["efp", projectId] });
            void navigate; // keep import used; nav stays on this page
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ onGenerate, message }: { onGenerate: () => void; message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center space-y-3">
      <BookOpen className="w-10 h-10 mx-auto text-[var(--color-text-muted)]" />
      <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">{message}</p>
      <button
        onClick={onGenerate}
        className="inline-flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90"
      >
        <Sparkles className="w-3.5 h-3.5" /> Generar borrador con IA
      </button>
    </div>
  );
}

function Toolbar({
  versions,
  currentVersion,
  onChangeVersion,
  onRegenerate,
  onSnapshot,
  onDownloadPdf,
  onDeleteVersion,
  canDelete,
}: {
  versions: EFPVersionDto[];
  currentVersion: EFPVersionDto;
  onChangeVersion: (id: string) => void;
  onRegenerate: () => void;
  onSnapshot: () => void;
  onDownloadPdf: () => void;
  onDeleteVersion: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <select
        value={currentVersion.id}
        onChange={(e) => onChangeVersion(e.target.value)}
        className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] font-mono"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            v{v.version} — {fmt(v.createdAt)}
            {v.aiGenerated ? " (IA)" : ""}
          </option>
        ))}
      </select>
      <div className="flex-1" />
      <button
        onClick={onRegenerate}
        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
        title="Generá una versión nueva con IA usando otras visitas"
      >
        <Sparkles className="w-3 h-3" /> Regenerar con IA
      </button>
      <button
        onClick={onSnapshot}
        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
        title="Crear una versión nueva como copia de la actual"
      >
        <RefreshCcw className="w-3 h-3" /> Snapshot
      </button>
      <button
        onClick={onDownloadPdf}
        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
      >
        <Download className="w-3 h-3" /> PDF
      </button>
      {canDelete && (
        <button
          onClick={onDeleteVersion}
          className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2.5 py-1 text-[11px] text-red-400 hover:bg-red-500/10"
          title="Eliminar esta versión"
        >
          <Trash2 className="w-3 h-3" /> Eliminar versión
        </button>
      )}
    </div>
  );
}

function SectionEditor({
  versionId,
  sectionKey,
  title,
  content,
  checklist,
  canEdit,
  onSaved,
}: {
  versionId: string;
  sectionKey: EFPSectionKey;
  title: string;
  content: string;
  checklist: string[] | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastSavedRef = useRef(content);

  // Sync from props if version changes from outside.
  useEffect(() => {
    setDraft(content);
    lastSavedRef.current = content;
  }, [versionId, content]);

  const saveMut = useMutation({
    mutationFn: (text: string) =>
      updateEFPVersion(versionId, { sectionKey, sectionContent: text }),
    onSuccess: () => {
      setSavedAt(Date.now());
      onSaved();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo guardar"),
  });

  function scheduleSave(text: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (text !== lastSavedRef.current) {
        lastSavedRef.current = text;
        saveMut.mutate(text);
      }
    }, 1500);
  }

  function commit() {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (draft !== lastSavedRef.current) {
      lastSavedRef.current = draft;
      saveMut.mutate(draft);
    }
    setEditing(false);
  }

  function cancel() {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setDraft(lastSavedRef.current);
    setEditing(false);
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {saveMut.isPending && (
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
              Guardando…
            </span>
          )}
          {!saveMut.isPending && savedAt && (
            <span className="text-[10px] text-emerald-400 font-mono inline-flex items-center gap-1">
              <Check className="w-3 h-3" /> Guardado
            </span>
          )}
          {!editing && canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Edit2 className="w-3 h-3" /> Editar
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            autoFocus
            rows={Math.max(8, draft.split("\n").length + 2)}
            onChange={(e) => {
              setDraft(e.target.value);
              scheduleSave(e.target.value);
            }}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-xs text-[var(--color-text-primary)] font-mono leading-relaxed focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="Markdown..."
          />
          <div className="flex items-center gap-2">
            <button
              onClick={commit}
              className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90"
            >
              <Check className="w-3 h-3" /> Guardar
            </button>
            <button
              onClick={cancel}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <X className="w-3 h-3" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
          {content || (
            <span className="italic text-[var(--color-text-muted)]">Sin contenido</span>
          )}
        </p>
      )}

      {checklist && checklist.length > 0 && (
        <div className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">
            Checklist sugerida por la IA
          </p>
          <ul className="space-y-1">
            {checklist.map((item, i) => (
              <li key={i} className="text-[11px] text-[var(--color-text-primary)] flex gap-2">
                <span className="text-[var(--color-text-muted)] shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AttachmentsBlock({
  efpId,
  attachments,
  canEdit,
  onChange,
}: {
  efpId: string;
  attachments: EFPAttachmentDto[];
  canEdit: boolean;
  onChange: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      await uploadEFPAttachment(efpId, file);
      toast.success("Anexo subido");
      onChange();
    } catch (err) {
      toast.error(getApiErr(err) ?? "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este anexo?")) return;
    try {
      await deleteEFPAttachment(id);
      toast.success("Anexo eliminado");
      onChange();
    } catch (err) {
      toast.error(getApiErr(err) ?? "No se pudo eliminar");
    }
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Anexos extras ({attachments.length})
        </h3>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_FOTOS_Y_PDF}
              onChange={handleUpload}
              className="hidden"
            />
            <button
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="w-3 h-3" /> {uploading ? "Subiendo…" : "Subir archivo"}
            </button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] italic">Sin anexos cargados.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {attachments.map((a) => (
            <AttachmentCard
              key={a.id}
              attachment={a}
              onDelete={() => handleDelete(a.id)}
              canEdit={canEdit}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function AttachmentCard({
  attachment,
  onDelete,
  canEdit,
  onChange,
}: {
  attachment: EFPAttachmentDto;
  onDelete: () => void;
  canEdit: boolean;
  onChange: () => void;
}) {
  const isImage = attachment.file?.mimeType?.startsWith("image/");
  const isPdf = attachment.file?.mimeType === "application/pdf";
  const previewUrl = attachment.file?.previewUrl ?? "";
  const [saving, setSaving] = useState(false);

  async function toggleIncludeInPdf(next: boolean) {
    setSaving(true);
    try {
      await patchEFPAttachment(attachment.id, { includeInPdf: next });
      onChange();
    } catch (err) {
      toast.error(getApiErr(err) ?? "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] overflow-hidden">
      <div className="relative bg-black/20 h-32 flex items-center justify-center">
        {isImage && previewUrl ? (
          <AuthedImage url={previewUrl} alt={attachment.file?.filename ?? "anexo"} />
        ) : (
          <FileText className="w-10 h-10 text-[var(--color-text-muted)]" />
        )}
        {canEdit && (
          <button
            onClick={onDelete}
            className="absolute top-1 right-1 p-1 rounded bg-black/60 hover:bg-red-500/40 text-white"
            title="Eliminar"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] truncate text-[var(--color-text-primary)]">
          {attachment.file?.filename ?? "—"}
        </p>
        {attachment.description && (
          <p className="text-[10px] text-[var(--color-text-muted)] truncate">
            {attachment.description}
          </p>
        )}
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
          {Math.round((attachment.file?.sizeBytes ?? 0) / 1024)} KB · {fmt(attachment.createdAt)}
        </p>
        {canEdit && (
          <label
            className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text-primary)]"
            title={
              isPdf
                ? "Si está marcado, el contenido del PDF se fusiona al final del documento principal."
                : "Si está marcado, aparece como separador con título 'ANEXO X' en el PDF. Las imágenes no se fusionan, solo el separador."
            }
          >
            <input
              type="checkbox"
              checked={attachment.includeInPdf}
              disabled={saving}
              onChange={(e) => toggleIncludeInPdf(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            <span>Incluir en PDF</span>
          </label>
        )}
      </div>
    </div>
  );
}

/** Carga la imagen vía fetch con auth y la muestra como blob. */
function AuthedImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    const token = localStorage.getItem("voltia-token");
    const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
    const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
    fetch(fullUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (cancelled || !b) return;
        blobUrl = URL.createObjectURL(b);
        setSrc(blobUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  if (!src) {
    return <Camera className="w-8 h-8 text-[var(--color-text-muted)]" />;
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
}

function GenerateModal({
  projectId,
  onClose,
  onGenerated,
}: {
  projectId: string;
  onClose: () => void;
  onGenerated: (versionId: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const visitsQ = useQuery({
    queryKey: ["technical-visits", projectId],
    queryFn: () => getVisitas(projectId),
  });

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateEFPWithAI(projectId, Array.from(selected));
      toast.success(`Versión v${result.version} generada con IA`);
      onGenerated(result.id);
    } catch (err) {
      toast.error(getApiErr(err) ?? "No se pudo generar");
    } finally {
      setGenerating(false);
    }
  }

  const visits = visitsQ.data ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg max-w-lg w-full p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Generar borrador con IA
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            La IA usará la pre-ingeniería del proyecto + las visitas técnicas que selecciones para
            armar un primer borrador. Vas a poder editarlo después.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-[var(--color-text-primary)] mb-2">
            Visitas técnicas disponibles
          </p>
          {visitsQ.isLoading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
          ) : visits.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] italic">
              No hay visitas técnicas. Vas a tener que completar varias secciones manualmente.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-60 overflow-y-auto">
              {visits.map((v) => (
                <VisitRow
                  key={v.id}
                  visit={v}
                  checked={selected.has(v.id)}
                  onToggle={() => toggle(v.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generating ? "Generando…" : "Generar borrador"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VisitRow({
  visit,
  checked,
  onToggle,
}: {
  visit: VisitListItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="flex items-start gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 accent-[var(--color-accent)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--color-text-primary)]">
            <span className="font-mono">{visit.visitType}</span>
            <span className="text-[var(--color-text-muted)]"> · {fmt(visit.visitDate)}</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
            {visit.createdBy.name} · {visit.inputsCount} input
            {visit.inputsCount === 1 ? "" : "s"} · {visit.reportsCount} informe
            {visit.reportsCount === 1 ? "" : "s"}
          </p>
        </div>
      </label>
    </li>
  );
}
