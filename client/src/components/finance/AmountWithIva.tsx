interface Props {
  sinIva: number;
  conIva: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  alignment?: 'left' | 'right';
  /** Color del monto principal (sin IVA). Usado en gastos negativos / saldos rojos. */
  primaryClassName?: string;
  /** Texto del prefijo del segundo renglón. Default: "c/IVA: " */
  conIvaPrefix?: string;
}

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Muestra dos montos: el principal (sin IVA) y debajo en gris la versión con
 * IVA. Pensado para KPIs y celdas de tablas. Uso típico:
 *
 *   <AmountWithIva sinIva={mov.monto} conIva={mov.monto * 1.22} />
 */
export function AmountWithIva({
  sinIva,
  conIva,
  currency = 'USD',
  size = 'md',
  alignment = 'right',
  primaryClassName = 'text-[var(--color-text-primary)]',
  conIvaPrefix = 'c/IVA: ',
}: Props) {
  const sizeClass =
    size === 'lg' ? 'text-2xl' :
    size === 'md' ? 'text-base' : 'text-sm';
  const alignClass = alignment === 'right' ? 'items-end text-right' : 'items-start text-left';

  return (
    <div className={`flex flex-col ${alignClass} tabular-nums`}>
      <span className={`font-bold ${sizeClass} ${primaryClassName}`}>
        {fmt(sinIva, currency)}
      </span>
      <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
        {conIvaPrefix}{fmt(conIva, currency)}
      </span>
    </div>
  );
}
