import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";

import { useCreatePlanPagos, usePlanPagos, type PlanCuota } from "../../hooks/usePlanPagos";
import { todayLocalISO } from "../../utils/date";

// Tolerancia en USD entre suma de cuotas y presupuesto. Mismo valor que el
// backend (SUM_TOLERANCE_USD). Si difiere por arriba, mostramos rojo.
const SUM_TOLERANCE_USD = 1;
const DEFAULT_SENIA_USD = 500;

type RowDraft = {
  descripcion: string;
  monto: number; // siempre representamos en number (NaN si está vacío)
  fechaPrevista: string; // yyyy-mm-dd
};

const inp =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";
const lbl =
  "block text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

function addDaysISO(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtUsd(n: number): string {
  return `USD ${n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Genera el plan por default 50/30/20 con seña fija USD 500 sobre el saldo
 *  pendiente (presupuesto - ya cobrado). Si saldoPendiente ≤ 0 retorna vacío. */
function buildDefaultPlan(saldoPendiente: number): RowDraft[] {
  if (saldoPendiente <= 0) return [];
  const today = todayLocalISO();
  const senia = Math.max(0, Math.min(DEFAULT_SENIA_USD, saldoPendiente * 0.5));
  // Cuota 1 completa hasta el 50% incluyendo la seña.
  let cuota1 = saldoPendiente * 0.5 - senia;
  let cuota2 = saldoPendiente * 0.3;
  let cuota3 = saldoPendiente * 0.2;
  // Ajuste de centavos: la última cuota absorbe la diferencia.
  const sumPrev = senia + cuota1 + cuota2 + cuota3;
  cuota3 += saldoPendiente - sumPrev;
  // Redondear a 2 decimales.
  const r = (n: number) => Math.round(n * 100) / 100;
  cuota1 = r(cuota1);
  cuota2 = r(cuota2);
  cuota3 = r(cuota3);
  return [
    { descripcion: "Seña", monto: r(senia), fechaPrevista: addDaysISO(today, 7) },
    { descripcion: "Cuota 1", monto: cuota1, fechaPrevista: addDaysISO(today, 30) },
    { descripcion: "Cuota 2", monto: cuota2, fechaPrevista: addDaysISO(today, 60) },
    { descripcion: "Cuota 3", monto: cuota3, fechaPrevista: addDaysISO(today, 90) },
  ];
}

function planFromCuotas(cuotas: PlanCuota[]): RowDraft[] {
  return cuotas.map((c) => ({
    descripcion: c.descripcion,
    monto: c.monto,
    fechaPrevista: c.dueDate ?? todayLocalISO(),
  }));
}

export function PlanPagosModal({
  projectId,
  projectName,
  onClose,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const planQ = usePlanPagos(projectId);
  const createMut = useCreatePlanPagos();

  const [rows, setRows] = useState<RowDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Inicializamos rows una sola vez con: plan vigente si hay; sino default
  // sobre el saldo pendiente (presupuesto - ya cobrado).
  useEffect(() => {
    if (initialized) return;
    if (!planQ.data) return;
    const saldo = planQ.data.saldoPendiente ?? 0;
    if (planQ.data.cuotas.length > 0) {
      setRows(planFromCuotas(planQ.data.cuotas));
    } else if (saldo > 0) {
      setRows(buildDefaultPlan(saldo));
    }
    setInitialized(true);
  }, [planQ.data, initialized]);

  const presupuesto = planQ.data?.presupuestoUsd ?? 0;
  const totalCobrado = planQ.data?.totalCobrado ?? 0;
  const saldoPendiente = planQ.data?.saldoPendiente ?? 0;
  const isEdit = (planQ.data?.cuotas.length ?? 0) > 0;

  const sumActual = useMemo(
    () => rows.reduce((acc, r) => acc + (Number.isFinite(r.monto) ? r.monto : 0), 0),
    [rows],
  );
  const diff = sumActual - saldoPendiente;
  const sumOk = Math.abs(diff) <= SUM_TOLERANCE_USD;
  const seniaMonto = rows[0]?.monto ?? 0;
  const seniaPct = saldoPendiente > 0 ? (seniaMonto / saldoPendiente) * 100 : 0;
  const seniaWarning = saldoPendiente > 0 && seniaPct > 50 && seniaMonto < saldoPendiente;
  const seniaError = seniaMonto >= saldoPendiente && saldoPendiente > 0;

  function patchRow(idx: number, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function pctOf(monto: number): number {
    if (saldoPendiente <= 0) return 0;
    return (monto / saldoPendiente) * 100;
  }

  function setMonto(idx: number, monto: number) {
    patchRow(idx, { monto });
  }

  function setPct(idx: number, pct: number) {
    if (saldoPendiente <= 0) return;
    const monto = Math.round(((saldoPendiente * pct) / 100) * 100) / 100;
    patchRow(idx, { monto });
  }

  function addCuota() {
    setRows((prev) => {
      const lastDate = prev[prev.length - 1]?.fechaPrevista ?? todayLocalISO();
      return [
        ...prev,
        {
          descripcion: `Cuota ${prev.length}`,
          monto: 0,
          fechaPrevista: addDaysISO(lastDate, 30),
        },
      ];
    });
  }

  function removeCuota(idx: number) {
    if (idx === 0) return; // no se borra la seña
    setRows((prev) => {
      const removed = prev[idx];
      const others = prev.filter((_, i) => i !== idx);
      // Redistribuir el monto eliminado proporcionalmente entre las cuotas
      // restantes EXCEPTO la seña.
      if (others.length <= 1 || saldoPendiente <= 0) return others;
      const totalOtros = others.slice(1).reduce((acc, r) => acc + r.monto, 0);
      if (totalOtros <= 0) return others;
      const extra = removed.monto;
      const r = (n: number) => Math.round(n * 100) / 100;
      const updated = others.map((row, i) => {
        if (i === 0) return row; // seña intacta
        const share = (row.monto / totalOtros) * extra;
        return { ...row, monto: r(row.monto + share) };
      });
      return updated;
    });
  }

  async function handleSubmit() {
    if (!sumOk || seniaError) return;
    try {
      const result = await createMut.mutateAsync({
        projectId,
        cuotas: rows.map((r) => ({
          descripcion: r.descripcion.trim(),
          monto: r.monto,
          fechaPrevista: r.fechaPrevista,
        })),
      });
      toast.success(
        result.replaced > 0
          ? `Plan reemplazado · ${result.replaced} previstas → ${result.created} nuevas`
          : `Plan creado · ${result.created} cuota${result.created === 1 ? "" : "s"} agendadas`,
      );
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo crear el plan");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isEdit ? "Editar plan de pagos" : "Plan de pagos"}
              <span className="text-[var(--color-text-muted)] font-normal"> — {projectName}</span>
            </h3>
            {presupuesto > 0 ? (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                <span>
                  Presupuesto:{" "}
                  <span className="text-[var(--color-text-secondary)] font-semibold tabular-nums">
                    {fmtUsd(presupuesto)}
                  </span>
                </span>
                <span className="text-[var(--color-border)]">|</span>
                <span>
                  Cobrado:{" "}
                  <span className="text-emerald-400 font-semibold tabular-nums">
                    {fmtUsd(totalCobrado)}
                  </span>
                </span>
                <span className="text-[var(--color-border)]">|</span>
                <span>
                  Pendiente:{" "}
                  <span
                    className={`font-semibold tabular-nums ${
                      saldoPendiente > 0
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {fmtUsd(saldoPendiente)}
                  </span>
                </span>
              </p>
            ) : (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                Este proyecto no tiene presupuesto cargado.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {planQ.isLoading || !planQ.data ? (
            <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
          ) : presupuesto <= 0 ? (
            <p className="text-xs text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]/30 border border-[var(--color-warning-bg)] rounded p-3">
              No hay presupuesto cargado. Cargá <code>budgetUsd</code> en el proyecto para usar el asistente.
            </p>
          ) : saldoPendiente <= 0 ? (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-3">
              Este proyecto ya tiene cobros por {fmtUsd(totalCobrado)} sobre un presupuesto de {fmtUsd(presupuesto)}. No queda saldo pendiente para planificar.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded border border-[var(--color-border)]">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--color-bg-app)]/60 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Descripción</th>
                      <th className="px-2 py-2 text-right font-medium w-28">Monto (USD)</th>
                      <th className="px-2 py-2 text-right font-medium w-20">%</th>
                      <th className="px-2 py-2 text-left font-medium w-36">Fecha esperada</th>
                      <th className="px-2 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {rows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-[var(--color-bg-card-hover)]/40">
                        <td className="px-2 py-2">
                          <input
                            className={inp}
                            value={r.descripcion}
                            onChange={(e) => patchRow(idx, { descripcion: e.target.value })}
                            placeholder={idx === 0 ? "Seña" : `Cuota ${idx}`}
                            maxLength={120}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`${inp} text-right tabular-nums`}
                            value={Number.isFinite(r.monto) ? r.monto : ""}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setMonto(idx, Number.isFinite(v) ? v : 0);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {idx === 0 ? (
                            <span className="block text-right text-[11px] tabular-nums text-[var(--color-text-muted)] px-1.5 py-1">
                              {pctOf(r.monto).toFixed(1)}%
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              className={`${inp} text-right tabular-nums`}
                              value={pctOf(r.monto).toFixed(2)}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (Number.isFinite(v)) setPct(idx, v);
                              }}
                            />
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="date"
                            className={inp}
                            value={r.fechaPrevista}
                            onChange={(e) => patchRow(idx, { fechaPrevista: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {idx > 0 ? (
                            <button
                              type="button"
                              onClick={() => removeCuota(idx)}
                              className="text-[var(--color-text-muted)] hover:text-[var(--color-danger-text)]"
                              title="Eliminar cuota"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={addCuota}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                >
                  <Plus className="w-3 h-3" /> Agregar cuota
                </button>

                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">
                    Total
                  </p>
                  <p
                    className={`text-base font-semibold tabular-nums ${
                      sumOk
                        ? "text-[var(--color-success-text)]"
                        : "text-[var(--color-danger-text)]"
                    }`}
                  >
                    {fmtUsd(sumActual)}
                    {sumOk && <span className="text-xs ml-1">✓</span>}
                  </p>
                  {!sumOk && (
                    <p className="text-[10px] text-[var(--color-danger-text)]">
                      {diff > 0 ? `Excede por ${fmtUsd(diff)}` : `Faltan ${fmtUsd(-diff)}`}
                    </p>
                  )}
                </div>
              </div>

              {seniaError && (
                <p className="mt-3 text-[11px] text-[var(--color-danger-text)] bg-[var(--color-danger-bg)]/40 border border-[var(--color-danger-bg)] rounded p-2 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  La seña no puede ser mayor o igual al saldo pendiente. Ajustá el monto antes de confirmar.
                </p>
              )}

              {seniaWarning && !seniaError && (
                <p className="mt-3 text-[11px] text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]/40 border border-[var(--color-warning-bg)] rounded p-2 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  La seña es mayor al 50% del saldo pendiente ({seniaPct.toFixed(1)}%). Confirmá que es intencional.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-app)]/30">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!sumOk || seniaError || createMut.isPending || saldoPendiente <= 0 || rows.length === 0}
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMut.isPending
              ? "Guardando…"
              : isEdit
                ? "Actualizar plan de pagos"
                : "Crear plan de pagos"}
          </button>
        </div>
      </div>
    </div>
  );
}
