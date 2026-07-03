import { useEffect, useState } from "react";

import type { AutosaveStatus } from "../../hooks/useDraftAutosave";

function relativeSince(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "recién";
  if (s < 60) return `hace ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return `hace ${h} h`;
}

export function AutosaveIndicator({
  status,
  lastSavedAt,
  onRetry,
}: {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  onRetry: () => void;
}) {
  // Tick por segundo para refrescar el "hace Xs" mientras está guardado.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "saved") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (status === "saving") {
    return <span className="text-xs text-[var(--color-text-muted)]">Guardando…</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-[var(--color-warning-text)]">Error, reintentando…</span>;
  }
  if (status === "error-final") {
    return (
      <span className="text-xs text-[var(--color-danger-text,#ef4444)]">
        Error, no se pudo guardar{" "}
        <button onClick={onRetry} className="underline hover:no-underline">
          reintentar
        </button>
      </span>
    );
  }
  if (status === "saved" && lastSavedAt) {
    return <span className="text-xs text-[var(--color-text-muted)]">Guardado {relativeSince(lastSavedAt)}</span>;
  }
  return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
}
