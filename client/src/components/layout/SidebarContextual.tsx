import type { ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useSidebarColapsado } from "../../hooks/useSidebarColapsado";

export const SIDEBAR_ANCHO = 220;

/**
 * El marco del sidebar contextual: la caja fija a la izquierda y el botón para
 * plegarla.
 *
 * Existe para que los tres módulos que muestran una lista al costado —Proyectos,
 * Ingeniería y Experiencia Solar— se plieguen igual y con la misma preferencia.
 * Cada uno pone adentro su propia lista.
 *
 * Plegado no es ocultar: queda una pestaña angosta con el botón, para que se
 * pueda volver sin tener que adivinar dónde estaba.
 */
export function SidebarContextual({ children }: { children: ReactNode }) {
  const [colapsado, alternar] = useSidebarColapsado();

  if (colapsado) {
    return (
      <button
        type="button"
        onClick={alternar}
        title="Mostrar la lista"
        aria-label="Mostrar la lista lateral"
        aria-expanded={false}
        className="fixed left-0 z-30 hidden items-center justify-center border-b border-r border-[var(--color-border)] bg-[var(--color-bg-sidebar)] py-2 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] md:flex"
        style={{ top: 52, width: 28 }}
      >
        <PanelLeftOpen className="h-4 w-4" />
      </button>
    );
  }

  return (
    <aside
      className="fixed bottom-0 left-0 z-30 hidden flex-col overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg-sidebar)] md:flex"
      style={{ top: 52, width: SIDEBAR_ANCHO }}
    >
      <div className="flex justify-end border-b border-[var(--color-border)] px-1 py-1">
        <button
          type="button"
          onClick={alternar}
          title="Ocultar la lista"
          aria-label="Ocultar la lista lateral"
          aria-expanded
          className="rounded p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      {children}
    </aside>
  );
}
