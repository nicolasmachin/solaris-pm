import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Check, ChevronDown, Download, FileSpreadsheet, FileText, Search, ShoppingCart, X } from "lucide-react";
import {
  consolidadoPdfUrl,
  consolidadoXlsxUrl,
  getConsolidadoVersion,
  getConsolidadoComprasOverlay,
  cascadeUpdateConsolidadoItem,
  type ComprasOverlayItem,
  type ItemConsolidado,
  type ProjectSnapshot,
} from "../../../api/consolidador.api";
import { usePermission } from "../../../hooks/usePermission";
import { useAuthStore } from "../../../store/auth.store";
import { StatusPill } from "../../project/materials/StatusPill";
import { MATERIAL_STATUSES, type MaterialStatus } from "../../../types/materials.types";
import { STATUS_META } from "../../project/materials/types";

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

// Toggle "Vista compras" persistido en localStorage.
const COMPRAS_VIEW_STORAGE_KEY = "consolidador-compras-view";

type ComprasFilterStatus = MaterialStatus | "MIXED";
type CrossedFilter = "all" | "yes" | "no";

export function ConsolidatedTableView({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "ADMIN";
  const canEdit = usePermission("INGENIERIA", "EDIT") || usePermission("OPERACIONES", "EDIT") || isAdmin;

  const [comprasOn, setComprasOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COMPRAS_VIEW_STORAGE_KEY) === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COMPRAS_VIEW_STORAGE_KEY, String(comprasOn));
  }, [comprasOn]);

  // Filtros locales al modal (no persistidos)
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComprasFilterStatus[]>([]);
  const [crossedFilter, setCrossedFilter] = useState<CrossedFilter>("all");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const versionQ = useQuery({
    queryKey: ["consolidado-version", id],
    queryFn: () => getConsolidadoVersion(id),
  });

  const overlayQ = useQuery({
    queryKey: ["consolidado-overlay", id],
    queryFn: () => getConsolidadoComprasOverlay(id),
    enabled: comprasOn,
    refetchOnWindowFocus: false,
  });

  // Map catalogItemId → overlay item para lookup O(1).
  const overlayByItem = useMemo(() => {
    const m = new Map<string, ComprasOverlayItem>();
    for (const it of overlayQ.data?.items ?? []) m.set(it.catalogItemId, it);
    return m;
  }, [overlayQ.data?.items]);

  // Cascade mutation
  const cascadeMut = useMutation({
    mutationFn: ({ catalogItemId, body }: { catalogItemId: string; body: { status?: MaterialStatus; crossed?: boolean } }) =>
      cascadeUpdateConsolidadoItem(id, catalogItemId, body),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["consolidado-overlay", id] });
      // Las listas de los proyectos individuales también pueden refrescar.
      qc.invalidateQueries({ queryKey: ["project-materials"] });
      const label = vars.body.status
        ? `Estado actualizado en ${data.updatedCount} proyecto${data.updatedCount === 1 ? "" : "s"}`
        : `${vars.body.crossed ? "Tachado" : "Destachado"} en ${data.updatedCount} proyecto${data.updatedCount === 1 ? "" : "s"}`;
      toast.success(label);
    },
    onError: () => toast.error("No se pudo aplicar la cascada"),
  });

  // Lista plana filtrada — necesaria para stats y para iterar.
  const allItems: ItemConsolidado[] = useMemo(() => versionQ.data?.itemsSnapshot ?? [], [versionQ.data?.itemsSnapshot]);

  const statsCounts = useMemo(() => {
    const c: Record<ComprasFilterStatus, number> = {
      PENDIENTE: 0, PEDIDO: 0, RECIBIDO: 0, EN_STOCK: 0, MIXED: 0,
    };
    for (const it of allItems) {
      const ov = overlayByItem.get(it.catalogItemId);
      const s = ov?.aggregatedStatus;
      if (s && s in c) c[s as ComprasFilterStatus] += 1;
    }
    return c;
  }, [allItems, overlayByItem]);

  function passesComprasFilters(it: ItemConsolidado): boolean {
    if (!comprasOn) return true;
    if (q.trim()) {
      const text = q.trim().toLowerCase();
      if (!it.nombre.toLowerCase().includes(text) && !it.categoria.toLowerCase().includes(text)) return false;
    }
    const ov = overlayByItem.get(it.catalogItemId);
    if (statusFilter.length > 0) {
      const agg = ov?.aggregatedStatus;
      if (!agg || !statusFilter.includes(agg as ComprasFilterStatus)) return false;
    }
    if (crossedFilter !== "all") {
      const isCrossed = ov?.isCrossed === true;
      if (crossedFilter === "yes" && !isCrossed) return false;
      if (crossedFilter === "no" && isCrossed) return false;
    }
    return true;
  }

  const grouped = useMemo(() => {
    const filtered = allItems.filter(passesComprasFilters);
    const map: Record<string, { categoria: string; orden: number; items: ItemConsolidado[] }> = {};
    for (const it of filtered) {
      if (!map[it.categoria]) {
        map[it.categoria] = { categoria: it.categoria, orden: it.categoriaOrden, items: [] };
      }
      map[it.categoria].items.push(it);
    }
    return Object.values(map).sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return a.categoria.localeCompare(b.categoria);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, comprasOn, q, statusFilter, crossedFilter, overlayByItem]);

  const filteredCount = useMemo(() => grouped.reduce((acc, g) => acc + g.items.length, 0), [grouped]);

  const projects: ProjectSnapshot[] = versionQ.data?.projectsSnapshot ?? [];
  const v = versionQ.data;

  const filtersActive = comprasOn && (q.trim() !== "" || statusFilter.length > 0 || crossedFilter !== "all");

  function toggleStatusFilter(s: ComprasFilterStatus) {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
                {filtersActive && ` · mostrando ${filteredCount}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setComprasOn((on) => !on)}
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors ${
                comprasOn
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-gray-900 font-semibold"
                  : "border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
              }`}
              title="Mostrar estado de compra de cada ítem"
            >
              <ShoppingCart className="w-3 h-3" /> Vista compras
            </button>
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

        {/* Filtros + stats (solo cuando Vista compras está ON) */}
        {comprasOn && (
          <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/40 shrink-0">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar ítem..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              {/* Estado multi-select */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
                    statusFilter.length > 0
                      ? "bg-[var(--color-warning-bg)]/30 border-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                      : "bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                  }`}
                >
                  🏷️ Estado
                  {statusFilter.length > 0 && (
                    <span className="bg-[var(--color-accent)] text-gray-900 text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full inline-flex items-center justify-center">
                      {statusFilter.length}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {statusDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setStatusDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 min-w-[200px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl z-30 p-1.5">
                      {MATERIAL_STATUSES.map((s) => (
                        <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
                          <input
                            type="checkbox"
                            checked={statusFilter.includes(s)}
                            onChange={() => toggleStatusFilter(s)}
                            className="accent-[var(--color-accent)]"
                          />
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: STATUS_META[s].dot }} />
                          <span className="text-xs text-[var(--color-text-primary)]">{STATUS_META[s].label}</span>
                          <span className="ml-auto text-[10px] tabular-nums text-[var(--color-text-muted)]">{statsCounts[s]}</span>
                        </label>
                      ))}
                      {statsCounts.MIXED > 0 && (
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--color-bg-card-hover)]">
                          <input
                            type="checkbox"
                            checked={statusFilter.includes("MIXED")}
                            onChange={() => toggleStatusFilter("MIXED")}
                            className="accent-[var(--color-accent)]"
                          />
                          <span className="inline-block w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />
                          <span className="text-xs text-[var(--color-text-primary)] italic">Mixto</span>
                          <span className="ml-auto text-[10px] tabular-nums text-[var(--color-text-muted)]">{statsCounts.MIXED}</span>
                        </label>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Tachados radio segmentado */}
              <div className="inline-flex items-center rounded-md border border-[var(--color-border)] overflow-hidden text-[10px]">
                {([
                  ["all", "Todos"],
                  ["no", "No tachados"],
                  ["yes", "Tachados"],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCrossedFilter(val)}
                    className={`px-2 py-1 transition-colors ${
                      crossedFilter === val
                        ? "bg-[var(--color-accent)] text-gray-900 font-semibold"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filtersActive && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setStatusFilter([]);
                    setCrossedFilter("all");
                  }}
                  className="ml-auto text-[11px] text-[var(--color-danger-text)] underline hover:no-underline font-semibold"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            {/* Stats */}
            <div className={`grid gap-2 px-4 pb-3 ${statsCounts.MIXED > 0 ? "grid-cols-2 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-5"}`}>
              <StatCard
                label={filtersActive ? "Mostrando" : "Total"}
                value={filtersActive ? `${filteredCount} / ${allItems.length}` : `${allItems.length}`}
                active={filtersActive}
              />
              {MATERIAL_STATUSES.map((s) => {
                const isActive = statusFilter.includes(s);
                return (
                  <StatCard
                    key={s}
                    label={STATUS_META[s].label}
                    value={String(statsCounts[s])}
                    dot={STATUS_META[s].dot}
                    active={isActive}
                    onClick={() => toggleStatusFilter(s)}
                  />
                );
              })}
              {statsCounts.MIXED > 0 && (
                <StatCard
                  label="Mixto"
                  value={String(statsCounts.MIXED)}
                  dot="#94a3b8"
                  active={statusFilter.includes("MIXED")}
                  onClick={() => toggleStatusFilter("MIXED")}
                />
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto px-4 py-3">
          {versionQ.isLoading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
          ) : !v ? (
            <p className="text-xs text-red-400">No se pudo cargar</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Sin proyectos</p>
          ) : grouped.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              {filtersActive ? "Ningún ítem coincide con los filtros." : "Los proyectos seleccionados no tienen ítems en sus listas."}
            </p>
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
                  <h4 className="font-mono text-[10px] uppercase tracking-widest text-gray-900 bg-[var(--color-accent)] px-3 py-1.5 rounded-t">
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
                          {comprasOn && <th className="px-2 py-1.5 w-32">Estado</th>}
                          {comprasOn && <th className="px-2 py-1.5 w-12 text-center">✓</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {group.items.map((item) => {
                          const overlay = overlayByItem.get(item.catalogItemId);
                          const aggregated = overlay?.aggregatedStatus ?? null;
                          const isCrossed = overlay?.isCrossed ?? false;
                          const itemRowClass = comprasOn && isCrossed ? "material-crossed" : "";
                          return (
                            <tr key={item.catalogItemId} className={`${itemRowClass} hover:bg-[var(--color-bg-card-hover)]`}>
                              <td className="px-2 py-1.5 text-[var(--color-text-primary)]">
                                <span className="crossable">{item.nombre}</span>
                              </td>
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
                                    <span className="crossable">{qty > 0 ? formatQty(qty) : "—"}</span>
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 text-right tabular-nums font-bold text-[var(--color-text-primary)]">
                                <span className="crossable">{formatQty(item.cantidadTotal)}</span>
                              </td>
                              {comprasOn && (
                                <td className="px-2 py-1.5">
                                  {aggregated === null ? (
                                    <span className="text-[10px] text-[var(--color-text-muted)] italic">sin proyectos</span>
                                  ) : (
                                    <StatusPill
                                      status={aggregated}
                                      disabled={!canEdit || cascadeMut.isPending}
                                      onChange={(s) =>
                                        cascadeMut.mutate({ catalogItemId: item.catalogItemId, body: { status: s } })
                                      }
                                    />
                                  )}
                                </td>
                              )}
                              {comprasOn && (
                                <td className="px-2 py-1.5 text-center">
                                  {canEdit && aggregated !== null && (
                                    <button
                                      type="button"
                                      title={isCrossed ? "Destachar en todos los proyectos" : "Tachar en todos los proyectos"}
                                      disabled={cascadeMut.isPending}
                                      onClick={() =>
                                        cascadeMut.mutate({ catalogItemId: item.catalogItemId, body: { crossed: !isCrossed } })
                                      }
                                      className={`w-6 h-6 inline-flex items-center justify-center rounded border transition-colors ${
                                        isCrossed
                                          ? "bg-[var(--color-warning-bg)]/40 border-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
                                          : "bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
                                      } ${cascadeMut.isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-muted)] flex items-center gap-2 shrink-0">
          <Download className="w-3 h-3" />
          <span>
            El consolidador agrupa ítems por ID de catálogo. Cuando "Vista compras" está activa, el estado y el tachado se aplican en cascada a TODOS los proyectos del consolidado.
            {overlayQ.isFetching && comprasOn && " · sincronizando…"}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  dot,
  active,
  onClick,
}: {
  label: string;
  value: string;
  dot?: string;
  active: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`text-left px-3 py-2 rounded-md border transition-colors ${
        active
          ? "bg-[var(--color-warning-bg)]/30 border-[var(--color-warning-bg)]"
          : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
      } ${clickable ? "cursor-pointer" : "cursor-default"}`}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
        {dot && <span className="inline-block w-2 h-2 rounded-full" style={{ background: dot }} />}
        {label}
      </p>
      <p className="text-base font-bold tabular-nums text-[var(--color-text-primary)] mt-0.5">{value}</p>
    </button>
  );
}
