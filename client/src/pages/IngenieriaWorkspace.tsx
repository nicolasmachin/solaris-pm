import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  ClipboardList,
  Download,
  FileText,
  HardHat,
  Lightbulb,
  Package,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getIngenieriaWorkspace,
  type IngenieriaWorkspaceDocument,
} from "../api/ingenieria.api";
import { ToolAccordion } from "../components/ingenieria/ToolAccordion";
import { UnifilarToolPanel } from "../components/ingenieria/unifilar/UnifilarToolPanel";
import { MaterialesToolPanel } from "../components/ingenieria/MaterialesToolPanel";
import { TriangulosToolPanel } from "../components/ingenieria/TriangulosToolPanel";
import { PreIngenieriaToolPanel } from "../components/ingenieria/preing/PreIngenieriaToolPanel";

const MONTHS_ES_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_ES_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

function iconFor(key: string): LucideIcon {
  if (key === "unifilar") return Zap;
  if (key === "triangulos") return Calculator;
  if (key === "materiales") return Package;
  if (key === "preing") return ClipboardList;
  if (key === "memoria") return FileText;
  return Lightbulb;
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

export function IngenieriaWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Sólo una herramienta abierta a la vez. Default cerrado para que el grid
  // de 2 columnas se vea balanceado al entrar.
  const [openToolKey, setOpenToolKey] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ingenieria-workspace", id],
    queryFn: () => getIngenieriaWorkspace(id!),
    enabled: !!id,
  });

  if (!id) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header>
        <Link
          to="/ingenieria"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al dashboard
        </Link>
        <div className="mt-2 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <HardHat className="w-5 h-5 text-[var(--color-accent)]" />
            {isLoading ? "Cargando…" : data?.project.cliente ?? "—"}
          </h1>
          {data?.etapa && (
            <p className="text-xs text-[var(--color-text-muted)] font-mono">
              Etapa Ingeniería: {data.etapa.estado} · Subetapas{" "}
              {data.etapa.subetapasCompletas}/{data.etapa.subetapasTotales} · {data.etapa.progressPercent}%
            </p>
          )}
        </div>
        {data?.project && (
          <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">
            {data.project.code} · {data.project.potenciaKwp} kWp · {data.project.ubicacion}
          </p>
        )}
      </header>

      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          No se pudo cargar el workspace.
        </div>
      )}

      {/* Herramientas — acordeón inline en grid de 2 columnas. La herramienta
          abierta ocupa ancho completo (span 2) para que el body inline (lista
          de materiales, fotos del unifilar, etc.) tenga espacio. */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Herramientas
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(data?.herramientas ?? []).map((h) => {
            const isOpen = openToolKey === h.key;
            return (
              <div key={h.key} className={isOpen ? "md:col-span-2" : ""}>
                <ToolAccordion
                  icon={iconFor(h.key)}
                  name={h.nombre}
                  status={h.estado}
                  available={h.disponible}
                  open={isOpen}
                  onToggle={() => setOpenToolKey(isOpen ? null : h.key)}
                >
                  {h.key === "unifilar" && <UnifilarToolPanel projectId={id} />}
                  {h.key === "materiales" && <MaterialesToolPanel projectId={id} />}
                  {h.key === "triangulos" && <TriangulosToolPanel projectId={id} />}
                  {h.key === "preing" && <PreIngenieriaToolPanel projectId={id} />}
                </ToolAccordion>
              </div>
            );
          })}
        </div>
      </section>

      {/* Documentos generados */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Documentos técnicos generados
            {data?.documentos && data.documentos.length > 0 && ` (${data.documentos.length})`}
          </p>
          {data?.project && (
            <button
              onClick={() => navigate(`/projects/${data.project.id}`)}
              className="text-[11px] text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
            >
              Ver todos en Documentos del proyecto <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
        {!data || data.documentos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center text-xs text-[var(--color-text-muted)]">
            Aún no hay documentos generados. Empezá creando una versión desde alguna herramienta.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.documentos.map((d) => (
              <DocRow key={d.id} doc={d} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DocRow({ doc }: { doc: IngenieriaWorkspaceDocument }) {
  const sourceLabel = doc.sourceLabel ?? doc.tipo ?? "Documento";
  return (
    <li className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5">
      <FileText className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-primary)] truncate">{doc.filename}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
          <span className="rounded bg-blue-500/15 text-blue-400 px-1.5 py-0.5 mr-1.5">{sourceLabel}</span>
          {formatShortDate(doc.createdAt)} · {Math.round(doc.sizeBytes / 1024)} KB
        </p>
      </div>
      <button
        onClick={() =>
          downloadWithAuth(doc.previewUrl, doc.filename).catch(() =>
            toast.error("No se pudo descargar"),
          )
        }
        className="p-1.5 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
        title="Descargar"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}
