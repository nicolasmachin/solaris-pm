import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { useIsMobile } from "../../hooks/useIsMobile";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLES =
  "a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])";

// Primitivo de modal/sheet compartido. En `< md` se presenta como bottom sheet
// (sube desde abajo, esquinas superiores redondeadas, footer con safe-area); en
// `≥ md` como modal centrado. Cierre por botón, ESC y tap en overlay; focus-trap
// y lock de body scroll propios (no toca el MobileNavDrawer). v1 sin
// drag-to-dismiss. Deuda: unificar el focus-trap con el del drawer.
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLockBodyScroll(open);

  // ESC + foco inicial al abrir.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      // Respeta un autoFocus interno (ej. un input con autoFocus): solo mueve el
      // foco si todavía no está dentro del panel.
      if (panel.contains(document.activeElement)) return;
      panel.querySelector<HTMLElement>(FOCUSABLES)?.focus();
    }, 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Focus-trap: Tab/Shift+Tab envuelven dentro del panel.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const f = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLES);
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const panelClass = isMobile
    ? "w-full max-h-[90vh] rounded-t-2xl"
    : "mx-4 w-full max-w-lg max-h-[88vh] rounded-xl shadow-2xl";

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/60 ${isMobile ? "items-end" : "items-center justify-center"}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onKeyDown={handleKeyDown}
        className={`flex flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-card)] ${panelClass}`}
      >
        {/* Header (no scrollea: solo el body lo hace) */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <h3 id={titleId} className="text-base font-semibold text-[var(--color-text-primary)]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tap-target -mr-2 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Footer sticky opcional (respeta safe-area en móvil) */}
        {footer && (
          <div
            className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3"
            style={isMobile ? { paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" } : undefined}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
