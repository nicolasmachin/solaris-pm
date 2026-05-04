import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, FileSpreadsheet, FileText, X } from "lucide-react";
import {
  consolidadoPdfUrl,
  consolidadoXlsxUrl,
  getConsolidadoVersion,
  type ItemConsolidado,
  type ProjectSnapshot,
} from "../../../api/consolidador.api";

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

function formatQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

export function ConsolidatedTableView({ id, onClose }: { id: string; onClose: () => void }) {
  const versionQ = useQuery({
    queryKey: ["consolidado-version", id],
    queryFn: () => getConsolidadoVersion(id),
  });

  const grouped = useMemo(() => {
    const items = versionQ.data?.itemsSnapshot ?? [];
    const map: Record<string, { categoria: string; orden: number; items: ItemConsolidado[] }> = {};
    for (const it of items) {
      if (!map[it.categoria]) {
        map[it.categoria] = { categoria: it.categoria, orden: it.categoriaOrden, items: [] };
      }
      map[it.categoria].items.push(it);
    }
    return Object.values(map).sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return a.categoria.localeCompare(b.categoria);
    });
  }, [versionQ.data?.itemsSnapshot]);

  const projects: ProjectSnapshot[] = versionQ.data?.projectsSnapshot ?? [];
  const v = versionQ.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-6xl h-[92vh] rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Consolidado v{v?.versionNumber ?? "…"}
              {v?.label ? <span className="text-[var(--color-text-muted)]"> · {v.label}</span> : null}
            </h3>
            {v && (
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                {fmt(v.createdAt)} · {projects.length} proyectos · {v.itemsSnapshot.length} ítems
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {v?.hasPdf && (
              <button
                onClick={() =>
                  downloadWithAuth(consolidadoPdfUrl(id), `consolidado-v${v.versionNumber}.pdf`).catch(() =>
                    toast.error("No se pudo descargar PDF"),
                  )
                }
                className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
              >
                <FileText className="w-3 h-3" /> PDF
              </button>
            )}
            {v?.hasXlsx && (
              <button
                onClick={() =>
                  downloadWithAuth(consolidadoXlsxUrl(id), `consolidado-v${v.versionNumber}.xlsx`).catch(() =>
                    toast.error("No se pudo descargar Excel"),
                  )
                }
                className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
              >
                <FileSpreadsheet className="w-3 h-3" /> Excel
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3">
          {versionQ.isLoading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
          ) : !v ? (
            <p className="text-xs text-red-400">No se pudo cargar</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Sin proyectos</p>
          ) : grouped.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Los proyectos seleccionados no tienen ítems en sus listas.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
                <p className="text-[11px] font-mono text-[var(--color-text-muted)] mb-1">Proyectos incluidos:</p>
                <ul className="text-xs space-y-0.5">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <span className="text-[var(--color-text-primary)]">{p.nombreCliente}</span>
                      <span className="text-[var(--color-text-muted)]"> · {p.potenciaKwp} kWp · {p.ubicacion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {grouped.map((group) => (
                <section key={group.categoria}>
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-white bg-[var(--color-accent)] px-3 py-1.5 rounded-t">
                    {group.categoria}
                  </h4>
                  <div className="overflow-x-auto rounded-b border border-t-0 border-[var(--color-border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">
                        <tr className="text-left text-[10px] uppercase tracking-wider font-mono">
                          <th className="px-2 py-1.5">Ítem</th>
                          <th className="px-2 py-1.5 w-16">Unidad</th>
                          {projects.map((p) => (
                            <th key={p.id} className="px-2 py-1.5 text-right tabular-nums">{p.nombreCliente}</th>
                          ))}
                          <th className="px-2 py-1.5 text-right font-bold tabular-nums">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {group.items.map((item) => (
                          <tr key={item.catalogItemId} className="hover:bg-[var(--color-bg-card-hover)]">
                            <td className="px-2 py-1.5 text-[var(--color-text-primary)]">{item.nombre}</td>
                            <td className="px-2 py-1.5 font-mono text-[10px] text-[var(--color-text-muted)]">{item.unidad}</td>
                            {projects.map((p) => {
                              const qty = item.cantidadesPorProyecto[p.id] ?? 0;
                              return (
                                <td
                                  key={p.id}
                                  className={`px-2 py-1.5 text-right tabular-nums ${
                                    qty === 0 ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"
                                  }`}
                                >
                                  {qty > 0 ? formatQty(qty) : "—"}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-right tabular-nums font-bold text-[var(--color-text-primary)]">
                              {formatQty(item.cantidadTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 shrink-0">
          <Download className="w-3 h-3" />
          El consolidador agrupa ítems por ID de catálogo. Si esperás cantidades distintas, revisá las listas individuales antes de comprar.
        </div>
      </div>
    </div>
  );
}
