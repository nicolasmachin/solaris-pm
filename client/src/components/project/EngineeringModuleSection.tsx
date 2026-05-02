import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowRight, Download, FileText, HardHat } from "lucide-react";
import { getProjectDocuments, type ProjectDocument } from "../../api/files.api";
import { usePermission } from "../../hooks/usePermission";

const MONTHS_ES_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_ES_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("voltia-token");
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;
  const res = await fetch(fullUrl, {
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

/**
 * Sección que se renderiza en el StageDrawer cuando `stage.name === "INGENIERIA"`.
 *
 * - Botón "Abrir en módulo Ingeniería" (gateado por INGENIERIA.VIEW): lleva al
 *   workspace técnico donde viven las herramientas (Unifilar, etc.).
 * - Lista read-only de documentos generados por herramientas (toolSource set).
 *   Visible para cualquier rol con permiso para ver Documentos del proyecto
 *   (gating ya aplicado por el endpoint `/api/projects/:id/documents`).
 */
export function EngineeringModuleSection({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const canAccessIngenieria = usePermission("INGENIERIA", "VIEW");

  const docsQ = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: () => getProjectDocuments(projectId),
    staleTime: 30_000,
  });

  const techDocs = useMemo<ProjectDocument[]>(
    () => (docsQ.data ?? []).filter((d) => d.toolSource != null),
    [docsQ.data],
  );

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
          <HardHat className="w-3 h-3" />
          Módulo Ingeniería
        </p>
        {canAccessIngenieria && (
          <button
            type="button"
            onClick={() => navigate(`/ingenieria/proyecto/${projectId}`)}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90"
            title="Trabajar en este proyecto desde el módulo técnico"
          >
            Abrir workspace
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {!canAccessIngenieria && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Sólo los roles ADMIN e INGENIERIA pueden trabajar en el módulo. Acá podés ver los
          documentos generados.
        </p>
      )}

      {/* Documentos técnicos generados (read-only) */}
      <div>
        <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)] mb-1.5">
          Documentos técnicos generados
          {techDocs.length > 0 && ` (${techDocs.length})`}
        </p>
        {docsQ.isLoading ? (
          <p className="text-[11px] text-[var(--color-text-muted)]">Cargando…</p>
        ) : techDocs.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-muted)] italic">
            Aún no hay documentos generados desde el módulo Ingeniería.
          </p>
        ) : (
          <ul className="space-y-1">
            {techDocs.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5"
              >
                <FileText className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[var(--color-text-primary)] truncate">
                    {d.filename}
                  </p>
                  <p className="text-[9px] text-[var(--color-text-muted)] font-mono mt-0.5">
                    <span className="rounded bg-blue-500/15 text-blue-400 px-1 py-0.5 mr-1.5">
                      {d.sourceLabel}
                    </span>
                    {formatShortDate(d.uploadedAt)} · {Math.round(d.sizeBytes / 1024)} KB
                  </p>
                </div>
                <button
                  onClick={() =>
                    downloadWithAuth(d.previewUrl, d.filename).catch(() =>
                      toast.error("No se pudo descargar"),
                    )
                  }
                  className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                  title="Descargar"
                >
                  <Download className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
