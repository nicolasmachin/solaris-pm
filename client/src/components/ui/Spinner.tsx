interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 20, className = "" }: SpinnerProps) {
  return (
    <span
      className={`inline-block border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
