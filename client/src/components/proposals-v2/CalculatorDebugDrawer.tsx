// Drawer lateral (solo admin) que muestra los intermedios de la calculadora del
// borrador en tiempo real. Ver docs/features/proposals-v2/DEBUG_CALCULADORA_SPEC.md.

import { useEffect } from "react";
import { X } from "lucide-react";

import { useDraftCalc } from "../../hooks/useDraftCalc";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import type { CalcDebugRow, CalcUnidad } from "../../types/proposals-v2";
import { Button } from "../ui/Button";

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString("es-UY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtValor(valor: number | number[], unidad: CalcUnidad): string {
  if (Array.isArray(valor)) return valor.map((n) => Math.round(n).toLocaleString("es-UY")).join(" · ");
  switch (unidad) {
    case "USD":
      return `USD ${fmtNum(valor)}`;
    case "pesos":
      return `$ ${fmtNum(valor)}`;
    case "UI":
      return `${fmtNum(valor)} UI`;
    case "%":
      return `${fmtNum(valor * 100, 1)} %`;
    case "kWh":
      return `${Math.round(valor).toLocaleString("es-UY")} kWh`;
    case "unidades":
      return Math.round(valor).toLocaleString("es-UY");
    default:
      return valor.toLocaleString("es-UY", { maximumFractionDigits: 2 });
  }
}

function Row({ row }: { row: CalcDebugRow }) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{row.label}</span>
        <span className="whitespace-nowrap text-sm tabular-nums text-[var(--color-text-primary)]">
          {fmtValor(row.valor, row.unidad)}
        </span>
      </div>
      {row.descripcion ? (
        <p className="mt-0.5 text-xs leading-snug text-[var(--color-text-muted)]">{row.descripcion}</p>
      ) : (
        <p className="mt-0.5 text-xs italic leading-snug text-[var(--color-text-muted)]">sin descripción</p>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="border-b border-[var(--color-border)] px-4 py-3">
          <div className="mb-2 h-3 w-1/2 rounded bg-[var(--color-border)]" />
          <div className="h-2 w-3/4 rounded bg-[var(--color-border)]" />
        </div>
      ))}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-6 text-center">{children}</div>;
}

export function CalculatorDebugDrawer({
  open,
  onClose,
  leadId,
  leadName,
  savedTick,
  autosaveError,
}: {
  open: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  savedTick: number;
  autosaveError: boolean;
}) {
  const calc = useDraftCalc({ leadId, savedTick, enabled: open, autosaveError });

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const estado =
    calc.status === "loading"
      ? "cargando…"
      : calc.stale
        ? "desactualizado"
        : calc.status === "success"
          ? "actualizado"
          : "";

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-label="Debug calculadora"
        className="absolute right-0 top-0 flex h-full w-[420px] max-w-full flex-col bg-[var(--color-bg-card)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Debug calculadora</h2>
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              Draft de {leadName}
              {estado ? (
                <>
                  {" — "}
                  <span className={calc.stale ? "text-[var(--color-warning-text)]" : ""}>{estado}</span>
                </>
              ) : null}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {calc.status === "loading" ? (
            <SkeletonRows />
          ) : calc.status === "invalid" ? (
            <Overlay>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Completá los campos obligatorios para ver los cálculos.
                </p>
                {calc.missing.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-left text-xs text-[var(--color-text-muted)]">
                    {calc.missing.map((m) => (
                      <li key={m}>· {m}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Overlay>
          ) : calc.status === "error" ? (
            <Overlay>
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No se pudieron cargar los cálculos. {calc.errorMsg}
                </p>
                <Button size="sm" variant="secondary" onClick={calc.refetch}>
                  Reintentar
                </Button>
              </div>
            </Overlay>
          ) : calc.rows && calc.rows.length > 0 ? (
            <div>
              {calc.rows.map((row) => (
                <Row key={row.key} row={row} />
              ))}
            </div>
          ) : (
            <Overlay>
              <p className="text-sm text-[var(--color-text-muted)]">No hay datos para mostrar.</p>
            </Overlay>
          )}
        </div>
      </aside>
    </div>
  );
}
