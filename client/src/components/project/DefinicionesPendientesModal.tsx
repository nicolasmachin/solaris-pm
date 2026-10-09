import { useQueryClient } from "@tanstack/react-query";

import { useDefinicionesPendientes } from "../../store/definicionesPendientes.store";
import { ModalidadPagoPanel } from "./ModalidadPagoPanel";

/**
 * El Onboarding no cierra sin saber cómo y cuándo paga el cliente. Los atajos
 * siguen existiendo, pero si falta esa definición, en lugar de tildar a ciegas
 * se abre esto: se elige la modalidad, se arma lo que pide (plan de pagos,
 * proforma o la explicación) y "Continuar" reintenta lo que se estaba haciendo.
 *
 * Montado una sola vez en AppLayout, como el aviso de traspaso.
 */
export function DefinicionesPendientesModal() {
  const qc = useQueryClient();
  const { pedido, cerrar } = useDefinicionesPendientes();
  if (!pedido) return null;

  function continuar() {
    if (!pedido) return;
    const { reintentar } = pedido;
    cerrar();
    // Si todavía falta algo, el reintento vuelve a fallar y el modal se reabre
    // con la lista actualizada.
    reintentar();
  }

  function cancelar() {
    cerrar();
    qc.invalidateQueries({ queryKey: ["stages"] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={cancelar} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Antes de cerrar el Onboarding
          </h2>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            El proyecto no avanza sin dejar definido cómo y cuándo paga el cliente.
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <ul className="space-y-1 text-sm text-[var(--color-text-primary)]">
            {pedido.faltantes.map((f) => (
              <li key={f.codigo} className="flex gap-2">
                <span className="text-[var(--color-warning-text)]">•</span>
                <span>{f.mensaje}</span>
              </li>
            ))}
          </ul>
          <ModalidadPagoPanel projectId={pedido.projectId} />
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={cancelar}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={continuar}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90"
          >
            Listo, continuar
          </button>
        </div>
      </div>
    </div>
  );
}
