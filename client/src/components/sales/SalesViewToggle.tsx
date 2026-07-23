import { useCallback, useEffect, useState } from "react";
import { LayoutGrid, List, ListChecks } from "lucide-react";

// Toggle visual entre la vista Kanban (default), la vista de lista y la vista
// priorizada de Ventas. La preferencia se persiste en localStorage clave
// `voltia.sales.view` para que sobreviva al refresh de la página y
// entre sesiones distintas del usuario.

const STORAGE_KEY = "voltia.sales.view";
const DEFAULT_VIEW: SalesView = "kanban";

export type SalesView = "list" | "kanban" | "priority";

function isSalesView(v: string | null): v is SalesView {
  return v === "list" || v === "kanban" || v === "priority";
}

function readStored(): SalesView {
  if (typeof window === "undefined") return DEFAULT_VIEW;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isSalesView(raw)) return raw;
  } catch {
    // localStorage puede estar bloqueado (modo incógnito estricto, etc.).
  }
  return DEFAULT_VIEW;
}

/**
 * Hook para usar desde el componente padre. Retorna el view actual y
 * un setter que persiste a localStorage.
 */
export function useSalesView(): [SalesView, (v: SalesView) => void] {
  const [view, setView] = useState<SalesView>(() => readStored());

  // Sincronizamos cambios externos (otra pestaña abierta) escuchando
  // storage events. No es crítico pero evita estados divergentes.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isSalesView(e.newValue)) {
        setView(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const update = useCallback((v: SalesView) => {
    setView(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // Igual que arriba — si localStorage está bloqueado, no rompemos.
    }
  }, []);

  return [view, update];
}

export function SalesViewToggle({
  view,
  onChange,
}: {
  view: SalesView;
  onChange: (v: SalesView) => void;
}) {
  return (
    <div
      className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5"
      role="tablist"
      aria-label="Vista del módulo Ventas"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "list"}
        title="Vista de lista"
        onClick={() => onChange("list")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
          view === "list"
            ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }`}
      >
        <List size={14} />
        Lista
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "kanban"}
        title="Vista Kanban"
        onClick={() => onChange("kanban")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
          view === "kanban"
            ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }`}
      >
        <LayoutGrid size={14} />
        Kanban
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "priority"}
        title="Vista priorizada"
        onClick={() => onChange("priority")}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors ${
          view === "priority"
            ? "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }`}
      >
        <ListChecks size={14} />
        Priorizada
      </button>
    </div>
  );
}
