import { FileCheck } from "lucide-react";

import { UTE_STAGE_LABELS } from "../constants";

interface ClienteTramiteUteCardProps {
  tramiteUte: { etapa: string; desde: string | null } | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Bloque acotado de estado UTE (lectura): etapa actual + desde cuándo. El
// timeline completo vive en el portal del cliente, no acá.
export function ClienteTramiteUteCard({ tramiteUte }: ClienteTramiteUteCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileCheck className="h-4 w-4 text-[var(--color-text-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Trámite UTE</h3>
      </div>

      {!tramiteUte ? (
        <p className="text-sm text-[var(--color-text-muted)]">Este cliente no tiene un trámite UTE registrado.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Etapa actual
            </dt>
            <dd className="text-sm font-medium text-[var(--color-text-primary)]">
              {UTE_STAGE_LABELS[tramiteUte.etapa] ?? tramiteUte.etapa}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Desde
            </dt>
            <dd className="text-sm text-[var(--color-text-primary)]">{fmtDate(tramiteUte.desde)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
