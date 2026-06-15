import { type ReactNode } from "react";

import { useIsMobile } from "../../hooks/useIsMobile";

export type CardRole = "title" | "highlight" | "hidden";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string; // clases extra para la celda (td) y el valor en card
  align?: "left" | "right" | "center";
  // Rol en modo card (`< md`): title = encabezado; highlight = valor destacado;
  // hidden = no se muestra en card; sin rol = par label/valor.
  cardRole?: CardRole;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  // Tap en la card (solo móvil; en desktop las filas no son clickeables).
  onRowClick?: (row: T) => void;
  // Qué filas son tappables en móvil (default: todas si hay onRowClick).
  isRowClickable?: (row: T) => boolean;
  emptyMessage?: ReactNode;
}

const alignClass: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

function cellContent<T>(col: Column<T>, row: T): ReactNode {
  if (col.render) return col.render(row);
  const v = (row as Record<string, unknown>)[col.key];
  return (v ?? "") as ReactNode;
}

// Primitivo declarativo: en `≥ md` renderiza una <table>; en `< md`, una card por
// fila según los cardRole de las columnas. Genérico y tipado, sin `any`.
export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  isRowClickable,
  emptyMessage,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
        {emptyMessage ?? "Sin datos."}
      </p>
    );
  }

  // ─── Móvil: cards ─────────────────────────────────────────────────────────
  if (isMobile) {
    const titleCol = columns.find((c) => c.cardRole === "title");
    const highlightCol = columns.find((c) => c.cardRole === "highlight");
    const bodyCols = columns.filter((c) => !c.cardRole);

    return (
      <div className="divide-y divide-[var(--color-border)]">
        {data.map((row) => {
          const clickable = !!onRowClick && (isRowClickable ? isRowClickable(row) : true);
          return (
            <div
              key={rowKey(row)}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onRowClick?.(row) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick?.(row);
                      }
                    }
                  : undefined
              }
              className={`px-4 py-3 ${clickable ? "cursor-pointer hover:bg-[var(--color-bg-card-hover)]" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                {titleCol && <div className="min-w-0 flex-1">{cellContent(titleCol, row)}</div>}
                {highlightCol && (
                  <div className="flex-shrink-0 text-right text-base font-semibold tabular-nums">
                    {cellContent(highlightCol, row)}
                  </div>
                )}
              </div>
              {bodyCols.length > 0 && (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  {bodyCols.map((col) => (
                    <div key={col.key} className="flex flex-col">
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                        {col.label}
                      </dt>
                      <dd className="text-xs text-[var(--color-text-primary)]">{cellContent(col, row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Desktop: tabla (idéntica al patrón actual) ───────────────────────────
  return (
    <table className="w-full text-sm">
      <thead className="bg-[var(--color-bg-app)] text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
        <tr>
          {columns.map((col) => (
            <th key={col.key} className={`px-4 py-2.5 font-medium ${col.align ? alignClass[col.align] : "text-left"}`}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-border)]">
        {data.map((row) => (
          <tr key={rowKey(row)} className="hover:bg-[var(--color-bg-card-hover)]">
            {columns.map((col) => (
              <td
                key={col.key}
                className={`px-4 py-3 ${col.align ? alignClass[col.align] : ""} ${col.className ?? ""}`}
              >
                {cellContent(col, row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
