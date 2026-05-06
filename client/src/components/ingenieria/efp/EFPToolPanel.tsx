import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { getEFP } from "../../../api/efp.api";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Panel inline del Proyecto Final de Ingeniería en el workspace de Ingeniería.
 *
 * Muestra el estado del documento (versión vigente, status) y un botón para
 * abrir la página dedicada donde el proyectista edita las 7 secciones inline
 * y maneja anexos/versiones/PDF.
 */
export function EFPToolPanel({ projectId }: { projectId: string }) {
  const navigate = useNavigate();

  const efpQ = useQuery({
    queryKey: ["efp", projectId],
    queryFn: () => getEFP(projectId),
  });

  const efp = efpQ.data?.efp ?? null;
  const lastVersion = efp?.versions[0] ?? null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        Documento integrador con datos del proyecto, pre-ingeniería y visitas técnicas. La IA arma
        un primer borrador y lo refinás inline (estilo Notion). Versionado y exportable a PDF.
      </p>

      {efpQ.isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : !efp ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            Aún no se generó el Proyecto Final. Empezá generando un borrador con IA.
          </p>
          <button
            onClick={() => navigate(`/ingenieria/proyecto/${projectId}/proyecto-final`)}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90"
          >
            <Sparkles className="w-3.5 h-3.5" /> Generar borrador con IA
          </button>
        </div>
      ) : (
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
          <div className="flex items-center gap-3">
            <BookOpen className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--color-text-primary)]">
                <span className="font-mono">v{lastVersion?.version ?? "?"}</span>
                <span className="text-[var(--color-text-muted)]"> · {efp.status}</span>
                {lastVersion?.aiGenerated && (
                  <span className="text-[var(--color-text-muted)]"> · generado con IA</span>
                )}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                {efp.versions.length} versión{efp.versions.length === 1 ? "" : "es"} ·{" "}
                {efp.attachments.length} anexo{efp.attachments.length === 1 ? "" : "s"}
                {lastVersion && ` · última actualización ${fmt(lastVersion.updatedAt)}`}
              </p>
            </div>
            <button
              onClick={() => navigate(`/ingenieria/proyecto/${projectId}/proyecto-final`)}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:bg-[var(--color-bg-card-hover)]"
            >
              Abrir <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
