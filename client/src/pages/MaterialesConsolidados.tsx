import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  HardHat,
  Info,
  Package,
  Plus,
  Table,
  Trash2,
} from "lucide-react";
import {
  consolidadoPdfUrl,
  consolidadoXlsxUrl,
  createConsolidado,
  deleteConsolidado,
  getConsolidadoVersions,
  getEligibleProjects,
} from "../api/consolidador.api";
import { ConsolidatedTableView } from "../components/ingenieria/consolidador/ConsolidatedTableView";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
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

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function MaterialesConsolidados() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [label, setLabel] = useState("");
  const [viewVersionId, setViewVersionId] = useState<string | null>(null);

  const eligibleQ = useQuery({
    queryKey: ["consolidado-elegibles"],
    queryFn: getEligibleProjects,
  });

  const versionsQ = useQuery({
    queryKey: ["consolidado-versions"],
    queryFn: getConsolidadoVersions,
  });

  const eligible = eligibleQ.data ?? [];
  const versions = versionsQ.data ?? [];
  const selectedCount = selected.size;

  function toggle(projectId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(eligible.map((p) => p.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  const orderedSelected = useMemo(() => {
    return eligible.filter((p) => selected.has(p.id)).map((p) => p.id);
  }, [eligible, selected]);

  const createMut = useMutation({
    mutationFn: () =>
      createConsolidado({
        label: label.trim() || null,
        projectIds: orderedSelected,
      }),
    onSuccess: (res) => {
      toast.success(`Consolidado v${res.versionNumber} generado`);
      qc.invalidateQueries({ queryKey: ["consolidado-versions"] });
      setSelected(new Set());
      setLabel("");
      setViewVersionId(res.id);
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo generar el consolidado"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteConsolidado(id),
    onSuccess: () => {
      toast.success("Consolidado eliminado");
      qc.invalidateQueries({ queryKey: ["consolidado-versions"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo eliminar"),
  });

  function handleDelete(id: string) {
    if (confirm("¿Eliminar este consolidado? Esta acción no se puede deshacer.")) {
      deleteMut.mutate(id);
    }
  }

  function handleGenerate() {
    if (orderedSelected.length < 2) {
      toast.error("Seleccioná al menos 2 proyectos");
      return;
    }
    createMut.mutate();
  }

  return (
    <div className="space-y-5">
      <header>
        <Link
          to="/ingenieria"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al dashboard
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Package className="w-5 h-5 text-[var(--color-accent)]" />
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Consolidador de materiales
          </h1>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">
          Unificá listas de materiales de varios proyectos para hacer las compras.
        </p>
      </header>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
        <Info className="w-3.5 h-3.5 text-[var(--color-accent)] mt-0.5 shrink-0" />
        <p>
          El consolidador agrupa ítems por <strong>ID de catálogo</strong>. Si esperás cantidades distintas a las que ves, revisá las listas individuales antes de hacer la compra.
        </p>
      </div>

      {/* ── Form: nuevo consolidado ── */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Nuevo consolidado
          </p>
          <button
            onClick={handleGenerate}
            disabled={selectedCount < 2 || createMut.isPending}
            className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-3 h-3" /> {createMut.isPending ? "Generando…" : `Generar (${selectedCount})`}
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
            Etiqueta (opcional)
          </label>
          <input
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            placeholder='Ej: "Compras semana 1 mayo"'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Proyectos elegibles ({eligible.length}) · con lista de materiales cargada
            </p>
            <div className="flex items-center gap-2 text-[10px]">
              <button onClick={selectAll} className="text-[var(--color-accent)] hover:underline">
                Seleccionar todos
              </button>
              <span className="text-[var(--color-text-muted)]">·</span>
              <button onClick={clearAll} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:underline">
                Deseleccionar
              </button>
            </div>
          </div>

          {eligibleQ.isLoading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
          ) : eligible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
              No hay proyectos con lista de materiales cargada.
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-80 overflow-auto">
              {eligible.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <label
                      className={`flex items-start gap-2 rounded border px-2.5 py-1.5 cursor-pointer transition-colors ${
                        checked
                          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                          : "border-[var(--color-border)] bg-[var(--color-bg-app)] hover:bg-[var(--color-bg-card-hover)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--color-text-primary)] truncate">
                          {p.nombreCliente}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                          {p.potenciaKwp} kWp · {p.cantidadItems} ítem{p.cantidadItems === 1 ? "" : "s"}
                          {p.ultimaActualizacion ? ` · actualizado ${fmt(p.ultimaActualizacion)}` : ""}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Historial ── */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          Historial ({versions.length})
        </p>
        {versionsQ.isLoading ? (
          <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
        ) : versions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center text-xs text-[var(--color-text-muted)]">
            Sin consolidados todavía.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5"
              >
                <HardHat className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--color-text-primary)]">
                    <span className="font-mono">v{v.versionNumber}</span>
                    {v.label && <span className="text-[var(--color-text-muted)]"> · {v.label}</span>}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                    {fmt(v.createdAt)} · {v.cantidadProyectos} proyectos · {v.cantidadItems} ítems
                  </p>
                </div>
                <button
                  onClick={() => setViewVersionId(v.id)}
                  className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
                  title="Ver tabla"
                >
                  <Table className="w-3 h-3" /> Ver
                </button>
                {v.hasPdf && (
                  <button
                    onClick={() =>
                      downloadWithAuth(consolidadoPdfUrl(v.id), `consolidado-v${v.versionNumber}.pdf`).catch(() =>
                        toast.error("No se pudo descargar PDF"),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
                    title="Descargar PDF"
                  >
                    <FileText className="w-3 h-3" /> PDF
                  </button>
                )}
                {v.hasXlsx && (
                  <button
                    onClick={() =>
                      downloadWithAuth(
                        consolidadoXlsxUrl(v.id),
                        `consolidado-v${v.versionNumber}.xlsx`,
                      ).catch(() => toast.error("No se pudo descargar Excel"))
                    }
                    className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
                    title="Descargar Excel"
                  >
                    <FileSpreadsheet className="w-3 h-3" /> Excel
                  </button>
                )}
                <button
                  onClick={() => handleDelete(v.id)}
                  className="p-1 rounded hover:bg-red-500/20 text-red-400"
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewVersionId && (
        <ConsolidatedTableView id={viewVersionId} onClose={() => setViewVersionId(null)} />
      )}
    </div>
  );
}
