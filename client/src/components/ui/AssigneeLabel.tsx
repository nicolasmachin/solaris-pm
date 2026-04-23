/**
 * Label del responsable de una Substage, Task o Stage.
 *
 * Muestra tres estados:
 *   - Si hay `user` (FK al User) → muestra user.name con estilo normal.
 *   - Si no hay `user` pero hay `legacyText` no vacío → muestra el texto
 *     atenuado + badge "legacy" al lado, para que el admin identifique
 *     rápidamente qué reasignar.
 *   - Si no hay ninguno → "Sin asignar" en italic y color muted.
 */
export function AssigneeLabel({
  user,
  legacyText,
  size = "sm",
}: {
  user: { name: string } | null | undefined;
  legacyText: string | null | undefined;
  size?: "sm" | "xs";
}) {
  const base = size === "xs" ? "text-[10px]" : "text-[11px]";
  if (user) {
    return <span className={`${base} text-[var(--color-text-secondary)]`}>{user.name}</span>;
  }
  if (legacyText && legacyText.trim() !== "") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`${base} text-[var(--color-text-muted)]`}>{legacyText}</span>
        <span className="rounded bg-[var(--color-border)] px-1 py-px text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
          legacy
        </span>
      </span>
    );
  }
  return <span className={`${base} text-[var(--color-text-muted)] italic`}>Sin asignar</span>;
}
