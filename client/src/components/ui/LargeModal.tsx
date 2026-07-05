import { type ReactNode } from "react";
import { X } from "lucide-react";

import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";

// Modal grande genérico (~90% del viewport). A propósito NO cierra con Escape ni
// con click en el backdrop: el único camino de salida es la X. Sin URL propia.
export function LargeModal({
  open,
  onClose,
  children,
  ariaLabel,
  size = "full",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  // "full" = ~90% viewport (constructor). "wide" = centrado max-w-6xl (panel del lead).
  size?: "full" | "wide";
}) {
  useLockBodyScroll(open);
  if (!open) return null;

  const panelSize =
    size === "wide" ? "h-[90vh] w-full max-w-6xl" : "h-[94vh] w-[94vw] xl:h-[90vh] xl:w-[90vw]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop: sin onClick (no cierra por click afuera). */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative flex ${panelSize} flex-col overflow-hidden rounded-xl bg-[var(--color-bg-app)] shadow-2xl`}
      >
        <div className="flex h-10 shrink-0 items-center justify-end border-b border-[var(--color-border)] px-2">
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
