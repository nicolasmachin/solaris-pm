import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowUpRight, Download, FileArchive } from "lucide-react";

import { getUteDocGenerado } from "../../api/uteDocs.api";
import { downloadAuthenticated } from "../../hooks/useAuthBlobUrl";

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

interface Props {
  projectId: string;
}

export function UteDocsGeneradosBlock({ projectId }: Props) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);

  const { data: generado, isLoading } = useQuery({
    queryKey: ["ute-docs-generado", projectId],
    queryFn: () => getUteDocGenerado(projectId),
  });

  async function handleDownload() {
    if (!generado || downloading) return;
    setDownloading(true);
    try {
      await downloadAuthenticated(generado.downloadUrl, generado.filename);
    } catch (err) {
      console.error("Error descargando ZIP UTE:", err);
      toast.error("No se pudo descargar el ZIP");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileArchive className="h-4 w-4 text-[var(--color-accent)]" />
        <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
          Documentos UTE generados
        </h3>
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : !generado ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-4 text-center">
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Todavía no se generaron los documentos UTE
          </p>
          <button
            type="button"
            onClick={() => navigate(`/ingenieria/proyecto/${projectId}/ute-docs`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
          >
            Generar ahora
          </button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">
            ZIP generado el {fmtDate(generado.createdAt)}
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--color-text-primary)] break-all">
            {generado.filename}{" "}
            <span className="font-normal text-[var(--color-text-muted)]">
              ({fmtSize(generado.sizeBytes)})
            </span>
          </p>
          {generado.uploadedBy?.name && (
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              Por: {generado.uploadedBy.name}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Download size={14} />
              {downloading ? "Descargando…" : "Descargar ZIP"}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/ingenieria/proyecto/${projectId}/ute-docs`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30"
            >
              <ArrowUpRight size={14} />
              Ir al generador
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
