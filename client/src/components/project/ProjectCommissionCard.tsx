import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins, Lock } from "lucide-react";

import { getProjectCommissionPreview } from "../../api/comisiones.api";
import { ManualCommissionModal } from "../comisiones/ManualCommissionModal";
import { Button } from "../ui/Button";

const fmtUsd = (v: number | null) =>
  v == null ? "—" : `US$ ${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)}`;

// Card SOLO ADMIN en la vista de proyecto: precarga la comisión del asesor (el que
// cerró la venta) con el 3% del presupuesto, editable en el modal manual.
export function ProjectCommissionCard({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["project-commission-preview", projectId],
    queryFn: () => getProjectCommissionPreview(projectId),
  });

  if (isLoading || !preview) return null;

  const {
    asesorId,
    asesorName,
    budgetUsd,
    montoSugeridoUsd,
    porcentajeSugerido,
    fechaVenta,
    clientName,
    yaExisteComision,
  } = preview;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Coins size={16} className="text-[var(--color-accent)]" />
        <h3 className="font-display font-semibold text-[var(--color-text-primary)]">Comisión del asesor</h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
          <Lock size={10} /> Solo admin
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <p className="text-[11px] text-[var(--color-text-muted)]">Asesor</p>
          <p className="text-[var(--color-text-primary)]">{asesorName ?? "Sin asignar"}</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--color-text-muted)]">Presupuesto</p>
          <p className="text-[var(--color-text-primary)]">{fmtUsd(budgetUsd)}</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--color-text-muted)]">Sugerido ({porcentajeSugerido}%)</p>
          <p className="font-semibold text-[var(--color-accent)]">{fmtUsd(montoSugeridoUsd)}</p>
        </div>
      </div>

      {yaExisteComision && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[12px] text-amber-400">
          Este proyecto ya tiene una comisión registrada. Si cargás otra, quedará duplicada.
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          Cargar comisión ({porcentajeSugerido}%)
        </Button>
      </div>

      <ManualCommissionModal
        open={open}
        onClose={() => setOpen(false)}
        initial={{
          asesorId: asesorId ?? undefined,
          montoUsd: montoSugeridoUsd,
          fecha: fechaVenta ?? undefined,
          concepto: `${porcentajeSugerido}% venta — ${clientName}`,
        }}
      />
    </div>
  );
}
