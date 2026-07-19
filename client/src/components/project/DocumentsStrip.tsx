import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Lock, Trash2, Upload } from "lucide-react";
import { getProjectDocuments, deleteFile, uploadFile, type ProjectDocument } from "../../api/files.api";
import { UteDocsGeneradosBlock } from "../ute/UteDocsGeneradosBlock";
import { UteDocsFirmadosBlock } from "../ute/UteDocsFirmadosBlock";
import { Spinner } from "../ui/Spinner";
import { useAuthBlobUrl, downloadAuthenticated } from "../../hooks/useAuthBlobUrl";
import { useAuthStore } from "../../store/auth.store";
import { toast } from "react-hot-toast";

const MONTHS_ES_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_ES_SHORT[d.getMonth()]}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function iconFor(mimeType: string): { emoji: string; color: string } {
  if (isPdf(mimeType)) return { emoji: "📄", color: "#DC2626" };
  if (isImage(mimeType)) return { emoji: "🖼️", color: "#2563EB" };
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return { emoji: "📊", color: "#059669" };
  if (mimeType.includes("word") || mimeType.includes("document")) return { emoji: "📝", color: "#1E40AF" };
  return { emoji: "📎", color: "#6B7280" };
}

type OriginFilter = "todos" | "manual" | "ingenieria" | "lista_materiales" | "presupuesto" | "calculo_triangulos";

const ORIGIN_FILTER_LABEL: Record<OriginFilter, string> = {
  todos: "Todos",
  manual: "Manual",
  ingenieria: "Ingeniería",
  lista_materiales: "Lista materiales",
  presupuesto: "Presupuesto",
  calculo_triangulos: "Cálculos",
};

function matchesOrigin(doc: ProjectDocument, filter: OriginFilter): boolean {
  if (filter === "todos") return true;
  if (filter === "ingenieria") return doc.toolSource != null;
  if (filter === "manual") return doc.tipo === "UPLOAD_MANUAL" || doc.tipo == null;
  if (filter === "lista_materiales") return doc.tipo === "LISTA_MATERIALES";
  if (filter === "presupuesto") return doc.tipo === "PRESUPUESTO";
  if (filter === "calculo_triangulos") return doc.tipo === "CALCULO_TRIANGULOS";
  return true;
}

export function DocumentsStrip({ projectId }: { projectId: string }) {
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [originFilter, setOriginFilter] = useState<OriginFilter>("todos");
  // Vista grilla (cards horizontales) o lista (filas verticales). La lista es
  // más cómoda para buscar cuando hay muchos adjuntos. Se recuerda la elección.
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("voltia-docs-view") === "list" ? "list" : "grid"),
  );
  const currentUser = useAuthStore(s => s.user);
  const qc = useQueryClient();

  // Subida de adjuntos a nivel proyecto (sin etapa). Antes solo se podía subir
  // desde dentro de cada etapa (StageDrawer); esto permite hacerlo desde la
  // vista general. El backend ya acepta subir con solo projectId.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  async function handleUpload(file: File) {
    try {
      setUploadPct(0);
      await uploadFile(projectId, file, null, setUploadPct);
      toast.success("Archivo subido");
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    } catch {
      toast.error("No se pudo subir el archivo");
    } finally {
      setUploadPct(null);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleUpload(file);
    e.target.value = ""; // permite re-subir el mismo archivo
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (uploadPct !== null) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  }

  function changeViewMode(mode: "grid" | "list") {
    setViewMode(mode);
    localStorage.setItem("voltia-docs-view", mode);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => getProjectDocuments(projectId),
  });

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => deleteFile(fileId),
    onSuccess: () => {
      toast.success("Archivo eliminado");
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
    },
    onError: () => toast.error("No se pudo eliminar el archivo"),
  });

  function handleDelete(doc: ProjectDocument) {
    if (!confirm(`¿Eliminar "${doc.filename}"?`)) return;
    deleteMut.mutate(doc.id);
  }

  function canDelete(doc: ProjectDocument): boolean {
    if (!currentUser) return false;
    // Documentos generados por herramientas (toolSource) son inmutables. Para
    // reemplazar el unifilar, hay que crear una nueva versión desde la
    // herramienta — eso soft-deletea el FileAttachment automáticamente.
    if (doc.toolSource != null) return false;
    return currentUser.role === "ADMIN" || doc.uploadedBy === currentUser.id;
  }

  // Archivos de tools que tienen su propia sección dedicada (bloques UTE,
  // galería de Obra) se excluyen de la lista general para no duplicar/ensuciar.
  // Los docs de Ingeniería (unifilar, preing, etc.) SÍ se muestran acá a propósito.
  const EXCLUDED_TOOL_SOURCES = ["ute-docs", "ute-docs-firmados", "obra-fotos"];
  const allDocuments = useMemo(
    () => (data ?? []).filter((d) => !d.toolSource || !EXCLUDED_TOOL_SOURCES.includes(d.toolSource)),
    [data],
  );
  const documents = useMemo(
    () => allDocuments.filter((d) => matchesOrigin(d, originFilter)),
    [allDocuments, originFilter],
  );

  // Conteos por origen para mostrar opciones que tengan al menos un doc.
  const counts = useMemo(() => {
    const c: Record<OriginFilter, number> = {
      todos: allDocuments.length,
      manual: 0,
      ingenieria: 0,
      lista_materiales: 0,
      presupuesto: 0,
      calculo_triangulos: 0,
    };
    for (const d of allDocuments) {
      if (d.toolSource != null) c.ingenieria++;
      if (d.tipo === "UPLOAD_MANUAL" || d.tipo == null) c.manual++;
      if (d.tipo === "LISTA_MATERIALES") c.lista_materiales++;
      if (d.tipo === "PRESUPUESTO") c.presupuesto++;
      if (d.tipo === "CALCULO_TRIANGULOS") c.calculo_triangulos++;
    }
    return c;
  }, [allDocuments]);

  return (
    <>
      {/* Bloques destacados de documentos UTE (arriba del listado general) */}
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <UteDocsGeneradosBlock projectId={projectId} />
        <UteDocsFirmadosBlock projectId={projectId} />
      </div>

      <section
        className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Documentos
          </p>
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {isLoading
                ? "Cargando…"
                : `${documents.length} ${documents.length === 1 ? "documento" : "documentos"}${
                    originFilter !== "todos" ? ` · filtrado: ${ORIGIN_FILTER_LABEL[originFilter]}` : ""
                  }`}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPct !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
              title="Subir un archivo a este proyecto"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadPct !== null ? `Subiendo… ${uploadPct}%` : "Subir archivo"}
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} />

        {/* Filtros de origen + toggle de vista — sólo si hay documentos */}
        {!isLoading && allDocuments.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex flex-wrap gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5 text-[10px]">
              {(Object.keys(ORIGIN_FILTER_LABEL) as OriginFilter[]).map((f) => {
                const n = counts[f];
                if (f !== "todos" && n === 0) return null;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setOriginFilter(f)}
                    className={`rounded px-2 py-0.5 transition-colors ${
                      originFilter === f
                        ? "bg-[var(--color-accent)] text-black font-semibold"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {ORIGIN_FILTER_LABEL[f]} ({n})
                  </button>
                );
              })}
            </div>

            <div className="inline-flex gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5">
              <button
                type="button"
                onClick={() => changeViewMode("grid")}
                aria-label="Vista de grilla"
                title="Vista de grilla"
                className={`rounded p-1 transition-colors ${
                  viewMode === "grid"
                    ? "bg-[var(--color-accent)] text-black"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => changeViewMode("list")}
                aria-label="Vista de lista"
                title="Vista de lista"
                className={`rounded p-1 transition-colors ${
                  viewMode === "list"
                    ? "bg-[var(--color-accent)] text-black"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            No se pudieron cargar los documentos.
          </p>
        ) : documents.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPct !== null}
            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-[var(--color-border)] py-8 text-center transition-colors hover:border-[var(--color-accent)] disabled:opacity-60"
          >
            <span className="text-sm text-[var(--color-text-muted)]">
              {uploadPct !== null
                ? `Subiendo… ${uploadPct}%`
                : "Este proyecto no tiene documentos adjuntos todavía."}
            </span>
            {uploadPct === null && (
              <span className="text-xs text-[var(--color-text-muted)]">
                Arrastrá un archivo acá o hacé clic para subir.
              </span>
            )}
          </button>
        ) : viewMode === "list" ? (
          <div className="flex flex-col gap-1">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onClick={() => setPreviewDoc(doc)}
                canDelete={canDelete(doc)}
                onDelete={() => handleDelete(doc)}
                deleting={deleteMut.isPending && deleteMut.variables === doc.id}
              />
            ))}
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <div className="flex gap-2 px-1 pb-1">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  onClick={() => setPreviewDoc(doc)}
                  canDelete={canDelete(doc)}
                  onDelete={() => handleDelete(doc)}
                  deleting={deleteMut.isPending && deleteMut.variables === doc.id}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {previewDoc ? (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      ) : null}
    </>
  );
}

function ImageThumb({ src, alt }: { src: string; alt: string }) {
  const { blobUrl, loading, error } = useAuthBlobUrl(src);
  if (loading || !blobUrl) {
    return (
      <span className="block h-full w-full animate-pulse rounded bg-[var(--color-border)]/40" />
    );
  }
  if (error) {
    return <span style={{ fontSize: 28 }}>🖼️</span>;
  }
  return (
    <img
      src={blobUrl}
      alt={alt}
      className="h-full w-full rounded object-cover"
      loading="lazy"
    />
  );
}

const TIPO_BADGE: Record<string, { label: string; color: string }> = {
  LISTA_MATERIALES: { label: "Lista materiales", color: "#1e40af" },
  PRESUPUESTO: { label: "Presupuesto", color: "#065f46" },
  UPLOAD_MANUAL: { label: "Manual", color: "#6B7280" },
  OTRO: { label: "Otro", color: "#6B7280" },
};

function DocumentCard({ doc, onClick, canDelete, onDelete, deleting }: {
  doc: ProjectDocument;
  onClick: () => void;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const icon = iconFor(doc.mimeType);
  const showThumb = isImage(doc.mimeType);
  // Origen tool-generado tiene precedencia sobre `tipo` para el badge.
  const isToolGenerated = doc.toolSource != null;
  const toolBadgeLabel = isToolGenerated
    ? `${doc.toolSource!.charAt(0).toUpperCase()}${doc.toolSource!.slice(1)}${
        doc.toolVersion ? ` v${doc.toolVersion}` : ""
      }`
    : null;
  const tipoBadge = !isToolGenerated && doc.tipo ? TIPO_BADGE[doc.tipo] : null;

  return (
    <div className="group relative flex w-[180px] shrink-0 flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-left transition-colors hover:border-[var(--color-text-secondary)]">
      {isToolGenerated ? (
        <span
          className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded bg-[var(--color-bg-card)] px-1 py-0.5 text-[8px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]"
          title="Documento generado automáticamente. Para reemplazarlo, creá una versión nueva desde la herramienta."
        >
          <Lock className="h-2.5 w-2.5" />
          inmutable
        </span>
      ) : (
        canDelete && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            disabled={deleting}
            title="Eliminar archivo"
            className="absolute right-1.5 top-1.5 rounded p-1 text-[var(--color-text-muted)] opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
            aria-label="Eliminar archivo"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )
      )}
      <button
        type="button"
        onClick={onClick}
        title={`${doc.filename}\n${doc.sourceLabel}`}
        className="flex flex-col gap-1.5 text-left"
      >
        <div className="flex h-20 items-center justify-center overflow-hidden rounded bg-[var(--color-bg-card)]">
          {showThumb ? (
            <ImageThumb src={doc.previewUrl} alt="" />
          ) : (
            <span style={{ fontSize: 36, color: icon.color }}>{icon.emoji}</span>
          )}
        </div>
        <p className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">
          {doc.filename}
        </p>
        <div className="flex items-center justify-between gap-1 text-[10px] text-[var(--color-text-muted)]">
          <span>{formatSize(doc.sizeBytes)}</span>
          <span>{formatShortDate(doc.uploadedAt)}</span>
        </div>
        {toolBadgeLabel ? (
          <span
            className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
            title={`Generado desde el módulo Ingeniería · ${toolBadgeLabel}`}
          >
            Ingeniería · {toolBadgeLabel}
          </span>
        ) : tipoBadge ? (
          <span
            className="mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: `${tipoBadge.color}22`, color: tipoBadge.color }}
          >
            {tipoBadge.label}
          </span>
        ) : null}
      </button>
    </div>
  );
}

// Fila de la vista lista: ancho completo, nombre prominente y metadatos en una
// línea — más cómoda para escanear/buscar cuando hay muchos adjuntos.
function DocumentRow({ doc, onClick, canDelete, onDelete, deleting }: {
  doc: ProjectDocument;
  onClick: () => void;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const icon = iconFor(doc.mimeType);
  const showThumb = isImage(doc.mimeType);
  const isToolGenerated = doc.toolSource != null;
  const toolBadgeLabel = isToolGenerated
    ? `${doc.toolSource!.charAt(0).toUpperCase()}${doc.toolSource!.slice(1)}${
        doc.toolVersion ? ` v${doc.toolVersion}` : ""
      }`
    : null;
  const tipoBadge = !isToolGenerated && doc.tipo ? TIPO_BADGE[doc.tipo] : null;

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 transition-colors hover:border-[var(--color-text-secondary)]">
      <button
        type="button"
        onClick={onClick}
        title={`${doc.filename}\n${doc.sourceLabel}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--color-bg-card)]">
          {showThumb ? (
            <ImageThumb src={doc.previewUrl} alt="" />
          ) : (
            <span style={{ fontSize: 18, color: icon.color }}>{icon.emoji}</span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[var(--color-text-primary)]">
            {doc.filename}
          </span>
          <span className="block truncate text-[10px] text-[var(--color-text-muted)]">
            {doc.sourceLabel} · {formatSize(doc.sizeBytes)} · {formatShortDate(doc.uploadedAt)}
          </span>
        </span>
        {toolBadgeLabel ? (
          <span
            className="ml-1 hidden shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider sm:inline-block"
            style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
          >
            Ingeniería · {toolBadgeLabel}
          </span>
        ) : tipoBadge ? (
          <span
            className="ml-1 hidden shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider sm:inline-block"
            style={{ background: `${tipoBadge.color}22`, color: tipoBadge.color }}
          >
            {tipoBadge.label}
          </span>
        ) : null}
      </button>

      {isToolGenerated ? (
        <span
          className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[var(--color-bg-card)] px-1 py-0.5 text-[8px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]"
          title="Documento generado automáticamente. Para reemplazarlo, creá una versión nueva desde la herramienta."
        >
          <Lock className="h-2.5 w-2.5" />
          inmutable
        </span>
      ) : (
        canDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={deleting}
            title="Eliminar archivo"
            aria-label="Eliminar archivo"
            className="shrink-0 rounded p-1 text-[var(--color-text-muted)] opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )
      )}
    </div>
  );
}

function DocumentPreviewModal({
  doc,
  onClose,
}: {
  doc: ProjectDocument;
  onClose: () => void;
}) {
  const canPreview = isPdf(doc.mimeType) || isImage(doc.mimeType);
  const { blobUrl, loading, error } = useAuthBlobUrl(canPreview ? doc.previewUrl : null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadAuthenticated(doc.downloadUrl, doc.filename);
    } catch {
      toast.error("No se pudo descargar el archivo");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[85vh] w-[85vw] max-w-6xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {doc.filename}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {formatSize(doc.sizeBytes)} · {formatShortDate(doc.uploadedAt)} · {doc.sourceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-black/40">
          {!canPreview ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Vista previa no disponible para este formato.
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Descargá el archivo para verlo.
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center gap-3 p-8">
              <Spinner />
              <p className="text-xs text-white/70">Cargando vista previa…</p>
            </div>
          ) : error || !blobUrl ? (
            <div className="p-8 text-center">
              <p className="text-sm text-white/80">
                No se pudo cargar el preview. Descargá el archivo para verlo.
              </p>
            </div>
          ) : isPdf(doc.mimeType) ? (
            <iframe
              src={blobUrl}
              title={doc.filename}
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <img
              src={blobUrl}
              alt={doc.filename}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
          >
            {downloading ? "Descargando…" : "Descargar"}
          </button>
        </div>
      </div>
    </div>
  );
}
