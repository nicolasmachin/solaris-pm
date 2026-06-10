import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Download, Eye, Paperclip, Pencil, Send, Trash2, Upload, X, FileText } from "lucide-react";

import type { InformeDetail } from "../../../api/informes.api";
import { downloadAuthenticated, previewAuthenticated } from "../../../hooks/useAuthBlobUrl";
import { useInformeMutations } from "../../../hooks/useInformes";
import { EstadoBadge } from "./EstadoBadge";

interface Props {
  informe: InformeDetail;
  onEditar: () => void;
  onBorrado: () => void;
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" });
}

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InformeDocument({ informe, onEditar, onBorrado }: Props) {
  const { enviar, borrar, subirAdjunto, borrarAdjunto } = useInformeMutations(informe.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const editable = informe.esAutor && informe.estado === "BORRADOR";

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSubiendo(true);
    try {
      for (const file of Array.from(files)) {
        await subirAdjunto.mutateAsync({ id: informe.id, file });
      }
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onEnviar() {
    if (informe.destinatarios.length === 0) return;
    enviar.mutate(informe.id);
  }

  function onBorrar() {
    if (!confirm("¿Eliminar este borrador? Esta acción no se puede deshacer.")) return;
    borrar.mutate(informe.id, { onSuccess: onBorrado });
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-1 flex items-center gap-2">
        <EstadoBadge estado={informe.estado} />
        {informe.project && (
          <span className="text-xs text-[var(--color-accent)]/90">
            {informe.project.codigo} · {informe.project.nombre}
          </span>
        )}
      </div>

      <h1 className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]">{informe.titulo}</h1>

      <div className="mb-6 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span>Por {informe.autor.nombre}</span>
        <span>·</span>
        <span>{fechaLarga(informe.enviadoAt ?? informe.createdAt)}</span>
      </div>

      {editable && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)]/50 px-3 py-2">
          <button
            onClick={onEditar}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={subiendo}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" /> {subiendo ? "Subiendo…" : "Adjuntar"}
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFile} />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onBorrar}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-500 hover:bg-rose-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Borrar
            </button>
            <button
              onClick={onEnviar}
              disabled={enviar.isPending || informe.destinatarios.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> {enviar.isPending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      )}

      <article className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-text-primary)]">
        {informe.cuerpo}
      </article>

      {informe.adjuntos.length > 0 && (
        <section className="mt-8 border-t border-[var(--color-border)] pt-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            <Paperclip className="h-3.5 w-3.5" /> Adjuntos ({informe.adjuntos.length})
          </h3>
          <ul className="space-y-1.5">
            {informe.adjuntos.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]/40 px-3 py-2"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />
                <span className="flex-1 truncate text-xs text-[var(--color-text-primary)]">{a.filename}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{tamano(a.sizeBytes)}</span>
                <button
                  onClick={() =>
                    previewAuthenticated(a.previewUrl).catch(() => toast.error("No se pudo abrir el archivo"))
                  }
                  className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)]"
                  title="Ver"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() =>
                    downloadAuthenticated(a.downloadUrl, a.filename).catch(() =>
                      toast.error("No se pudo descargar el archivo"),
                    )
                  }
                  className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)]"
                  title="Descargar"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {editable && (
                  <button
                    onClick={() => borrarAdjunto.mutate({ id: informe.id, fileId: a.id })}
                    className="rounded p-1 text-rose-500 hover:bg-rose-500/10"
                    title="Quitar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
