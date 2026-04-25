import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<Variant, string> = {
  // primary usa gradient amarillo Voltia (light: #fbbf24 → #f59e0b,
  // dark: equivalente a accent-hover → accent). Texto oscuro hardcodeado
  // en ambos modos porque el bg amarillo no varía suficiente entre temas.
  primary:
    "bg-[linear-gradient(135deg,var(--color-accent-hover)_0%,var(--color-accent)_100%)] hover:opacity-95 text-[#1f2937] font-bold",
  secondary:
    "bg-[var(--color-border)] hover:bg-[var(--color-border-hover)] text-[var(--color-text-primary)]",
  ghost:
    "bg-transparent hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
  danger: "bg-[var(--color-danger-bg)] hover:opacity-90 text-[var(--color-danger-text)] font-semibold",
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-6 py-3 text-base rounded-lg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${className}
      `}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
