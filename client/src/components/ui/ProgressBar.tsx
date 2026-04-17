interface ProgressBarProps {
  value: number; // 0-100
  height?: number;
  className?: string;
}

export function ProgressBar({ value, height = 3, className = "" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const color = clamped >= 100 ? "#4ade80" : "var(--color-accent)";
  return (
    <div
      className={`w-full rounded-full overflow-hidden bg-[var(--color-border)] ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
