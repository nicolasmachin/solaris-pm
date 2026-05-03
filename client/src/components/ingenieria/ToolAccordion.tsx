import type { ReactNode } from "react";
import { ChevronDown, Lock, type LucideIcon } from "lucide-react";

/**
 * Acordeón de herramienta del workspace de Ingeniería.
 * Header clickeable (cuando está disponible) que abre/cierra el body inline.
 * Las herramientas no disponibles muestran header sin chevron y no son
 * clickeables (caso "Próximamente").
 */
export function ToolAccordion({
  icon: Icon,
  name,
  status,
  available,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  name: string;
  status: string;
  available: boolean;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const disabled = !available;

  return (
    <div
      className={`rounded-lg border bg-[var(--color-bg-card)] ${
        disabled
          ? "border-[var(--color-border)] opacity-60"
          : open
            ? "border-[var(--color-accent)]/40"
            : "border-[var(--color-border)] hover:border-[var(--color-text-muted)]"
      } transition-colors`}
    >
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
          disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-[var(--color-bg-card-hover)]"
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${
            disabled ? "bg-[var(--color-bg-app)]" : "bg-[var(--color-accent)]/15"
          }`}
        >
          {disabled ? (
            <Lock className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <Icon className="w-5 h-5 text-[var(--color-accent)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{name}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{status}</p>
        </div>
        {!disabled && (
          <ChevronDown
            className={`w-4 h-4 text-[var(--color-text-muted)] shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {available && open && children && (
        <div className="border-t border-[var(--color-border)] px-4 py-4">{children}</div>
      )}
    </div>
  );
}
