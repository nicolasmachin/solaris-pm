import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { confirmCommission, getEligibleProposals } from "../../api/comisiones.api";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

// Modal de captura de comisión (Etapa 2). Se abre al marcar el lead como
// Ganado: el usuario elige la propuesta aceptada (default: la última publicada)
// y se congela la comisión + se genera el pendiente en Finanzas. Si el lead solo
// tiene propuestas viejas (sin snapshot), un ADMIN/FINANZAS carga el monto manual.

interface Props {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadClientName: string;
  // El usuario puede cargar monto manual (ADMIN/FINANZAS).
  canManual: boolean;
}

function fmtUsd(v: number | null) {
  if (v == null) return "—";
  return "US$ " + v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

export function CommissionCaptureModal({ open, onClose, leadId, leadClientName, canManual }: Props) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState("");

  const eligibleQ = useQuery({
    queryKey: ["eligible-proposals", leadId],
    queryFn: () => getEligibleProposals(leadId),
    enabled: open,
  });

  const proposals = eligibleQ.data?.proposals ?? [];
  const onlyOld = eligibleQ.data?.onlyOld ?? false;

  // Default: la propuesta marcada isDefault (la de mayor versión).
  const defaultId = useMemo(() => proposals.find((p) => p.isDefault)?.id ?? proposals[0]?.id ?? null, [proposals]);
  const effectiveSelected = selectedId ?? defaultId;

  const confirmMut = useMutation({
    mutationFn: (body: { proposalVersionId?: string; montoManualUsd?: number }) =>
      confirmCommission(leadId, body),
    onSuccess: (res) => {
      toast.success(res.created ? "Comisión registrada." : "Ya había una comisión para este lead.");
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["commission-metrics"] });
      qc.invalidateQueries({ queryKey: ["lead-commission", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo registrar la comisión.");
    },
  });

  if (!open) return null;

  const showManual = proposals.length === 0 && canManual;
  const blockedOld = proposals.length === 0 && !canManual;

  const manualNum = Number(manualAmount);
  const canConfirm = proposals.length > 0
    ? Boolean(effectiveSelected)
    : showManual
      ? manualNum > 0
      : false;

  function handleConfirm() {
    if (proposals.length > 0 && effectiveSelected) {
      confirmMut.mutate({ proposalVersionId: effectiveSelected });
    } else if (showManual && manualNum > 0) {
      confirmMut.mutate({ montoManualUsd: manualNum });
    }
  }

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <h3 className="mb-1 font-display text-lg font-bold text-[var(--color-text-primary)]">
          Comisión del asesor
        </h3>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {leadClientName} · ¿Qué propuesta aceptó el cliente? Se congela la comisión y se genera el
          pendiente en Finanzas.
        </p>

        {eligibleQ.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-[var(--color-text-secondary)]">
            <Spinner size={16} /> Cargando propuestas…
          </div>
        ) : proposals.length > 0 ? (
          <div className="space-y-2">
            {proposals.map((p) => {
              const checked = effectiveSelected === p.id;
              return (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                    checked
                      ? "border-[var(--color-accent)] bg-[var(--color-bg-card-hover)]"
                      : "border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="proposal"
                    checked={checked}
                    onChange={() => setSelectedId(p.id)}
                    className="accent-[var(--color-accent)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Versión {p.versionNumber}
                      </span>
                      {p.isDefault && (
                        <span className="rounded bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                          última
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {fmtDate(p.publishedAt)} · Total {fmtUsd(p.totalConIva)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[var(--color-text-muted)]">Comisión</p>
                    <p className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {fmtUsd(p.comisionVentasUsdSinIva)}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        ) : showManual ? (
          <div className="space-y-2">
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
              Este lead no tiene propuestas nuevas con comisión calculada
              {onlyOld ? " (solo propuestas viejas)" : ""}. Cargá el monto de comisión manualmente.
            </p>
            <label className="block text-xs text-[var(--color-text-muted)]">Monto de comisión (USD)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </div>
        ) : blockedOld ? (
          <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-sm text-[var(--color-text-secondary)]">
            La venta se cerró con una propuesta vieja (sin comisión calculada). Un administrador debe
            registrar la comisión manualmente desde este lead.
          </p>
        ) : (
          <p className="py-4 text-sm text-[var(--color-text-secondary)]">
            No hay propuestas disponibles para calcular la comisión.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {blockedOld ? "Cerrar" : "Más tarde"}
          </Button>
          {!blockedOld && (
            <Button loading={confirmMut.isPending} disabled={!canConfirm} onClick={handleConfirm}>
              Registrar comisión
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
