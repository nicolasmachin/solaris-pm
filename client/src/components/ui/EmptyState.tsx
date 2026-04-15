interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
}

export function EmptyState({ title, description, icon = "○" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <span className="text-3xl mb-3 text-[var(--color-text-muted)]">{icon}</span>
      <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>
      )}
    </div>
  );
}
