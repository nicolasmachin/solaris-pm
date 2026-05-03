import { useState } from "react";
import { Triangle } from "lucide-react";
import { TriangleCalculatorModal } from "../project/TriangleCalculator";

/**
 * Panel inline de la herramienta "Cálculos estructurales (triángulos)" en el
 * workspace de Ingeniería. Botón que abre el modal `TriangleCalculatorModal`
 * (mismo modal que se usaba en el StageDrawer). Cada cálculo guardado genera
 * un JPG + PDF como `FileAttachment` con `toolSource="triangulos"` y aparece
 * en "Documentos técnicos generados" del workspace y en el StageDrawer.
 */
export function TriangulosToolPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        Calculadora de triángulos isósceles de aluminio. Al guardar el cálculo se genera el PDF
        que queda como documento técnico del proyecto.
      </p>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
      >
        <Triangle className="w-3 h-3" /> Abrir calculadora
      </button>

      {open && (
        <TriangleCalculatorModal
          projectId={projectId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
