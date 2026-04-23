import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjectDocuments, type ProjectDocument } from "../../api/files.api";
import { Spinner } from "../ui/Spinner";

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

export function DocumentsStrip({ projectId }: { projectId: string }) {
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["project", projectId, "documents"],
    queryFn: () => getProjectDocuments(projectId),
  });

  const documents = data ?? [];

  return (
    <>
      <section className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Documentos
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {isLoading
              ? "Cargando…"
              : `${documents.length} ${documents.length === 1 ? "documento cargado" : "documentos cargados"}`}
          </p>
        </div>

        {isLoading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            No se pudieron cargar los documentos.
          </p>
        ) : documents.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            Este proyecto no tiene documentos adjuntos todavía.
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <div className="flex gap-2 px-1 pb-1">
              {documents.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} onClick={() => setPreviewDoc(doc)} />
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

function DocumentCard({ doc, onClick }: { doc: ProjectDocument; onClick: () => void }) {
  const icon = iconFor(doc.mimeType);
  const thumb = isImage(doc.mimeType) ? doc.previewUrl : null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${doc.filename}\n${doc.sourceLabel}`}
      className="group flex w-[180px] shrink-0 flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-left transition-colors hover:border-[var(--color-text-secondary)]"
    >
      <div className="flex h-20 items-center justify-center rounded bg-[var(--color-bg-card)]">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="h-full w-full rounded object-cover"
            loading="lazy"
          />
        ) : (
          <span style={{ fontSize: 36, color: icon.color }}>{icon.emoji}</span>
        )}
      </div>
      <p
        className="truncate text-[12px] font-medium text-[var(--color-text-primary)]"
      >
        {doc.filename}
      </p>
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>{formatSize(doc.sizeBytes)}</span>
        <span>{formatShortDate(doc.uploadedAt)}</span>
      </div>
    </button>
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

        <div className="flex-1 overflow-auto bg-black/40 flex items-center justify-center">
          {isPdf(doc.mimeType) ? (
            <iframe
              src={doc.previewUrl}
              title={doc.filename}
              className="h-full w-full border-0 bg-white"
            />
          ) : isImage(doc.mimeType) ? (
            <img
              src={doc.previewUrl}
              alt={doc.filename}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Vista previa no disponible para este formato.
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Descargá el archivo para verlo.
              </p>
            </div>
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
          <a
            href={doc.downloadUrl}
            download={doc.filename}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90"
          >
            Descargar
          </a>
        </div>
        {!canPreview && null}
      </div>
    </div>
  );
}
