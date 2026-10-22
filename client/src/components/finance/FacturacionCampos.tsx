import type { FacturacionInput } from '../../api/finance.api';

// Qué se le factura al cliente: "facturación normal" (todo el presupuesto) o
// otro monto con su motivo. El monto se puede escribir sin IVA, con IVA o como
// porcentaje del presupuesto: al llenar uno, los otros dos se calculan solos.
// Lo usan el paso de ganar el lead, la ficha del proyecto y Finanzas.

const IVA = 0.22;

export type FacturacionDraft = {
  normal: boolean;
  sinIva: string;
  conIva: string;
  pct: string;
  motivo: string;
};

export const DRAFT_VACIO: FacturacionDraft = { normal: false, sinIva: '', conIva: '', pct: '', motivo: '' };

// Acepta "1.234,56" y "1234.56" (un punto con 1 o 2 decimales es la coma decimal).
function aNumero(v: string): number {
  const t = v.trim();
  if (!t) return NaN;
  if (!t.includes(',') && /^\d+\.\d{1,2}$/.test(t)) return Number(t);
  return Number(t.replace(/\./g, '').replace(',', '.'));
}
const aTexto = (n: number) => (Number.isFinite(n) ? (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') : '');

/** Arma el borrador desde lo guardado en el proyecto. */
export function draftDesde(
  p: { facturacionNormal: boolean | null; facturarSinIvaUsd: number | null; facturaNota: string | null },
  presupuesto: number | null,
): FacturacionDraft {
  if (p.facturacionNormal === true) return { ...DRAFT_VACIO, normal: true, motivo: p.facturaNota ?? '' };
  if (p.facturacionNormal === false && p.facturarSinIvaUsd != null) {
    const sin = p.facturarSinIvaUsd;
    return {
      normal: false, sinIva: aTexto(sin), conIva: aTexto(sin * (1 + IVA)),
      pct: presupuesto ? aTexto((sin * (1 + IVA) * 100) / presupuesto) : '', motivo: p.facturaNota ?? '',
    };
  }
  return { ...DRAFT_VACIO, motivo: p.facturaNota ?? '' };
}

/** Lo que se manda al servidor, o el texto del error si falta algo. */
export function draftAInput(d: FacturacionDraft): FacturacionInput | string {
  if (d.normal) return { normal: true, motivo: d.motivo.trim() || null };
  const sin = aNumero(d.sinIva);
  if (!Number.isFinite(sin) || sin < 0) return 'Falta el monto a facturar (o tildá «Facturación normal»)';
  if (d.motivo.trim().length < 3) return 'Falta el motivo de la facturación distinta';
  return { normal: false, sinIvaUsd: Math.round(sin * 100) / 100, motivo: d.motivo.trim() };
}

export function FacturacionCampos({
  value, onChange, presupuesto, inputCls, labelCls,
}: {
  value: FacturacionDraft;
  onChange: (d: FacturacionDraft) => void;
  /** Presupuesto de la obra (total con IVA), base del porcentaje. */
  presupuesto: number | null;
  inputCls: string;
  labelCls: string;
}) {
  const conPresupuesto = presupuesto != null && presupuesto > 0;

  function desdeSinIva(txt: string) {
    const n = aNumero(txt);
    const con = n * (1 + IVA);
    onChange({ ...value, sinIva: txt, conIva: aTexto(con), pct: conPresupuesto ? aTexto((con * 100) / presupuesto!) : '' });
  }
  function desdeConIva(txt: string) {
    const n = aNumero(txt);
    onChange({ ...value, conIva: txt, sinIva: aTexto(n / (1 + IVA)), pct: conPresupuesto ? aTexto((n * 100) / presupuesto!) : '' });
  }
  function desdePct(txt: string) {
    const p = aNumero(txt);
    const con = conPresupuesto ? (presupuesto! * p) / 100 : NaN;
    onChange({ ...value, pct: txt, conIva: aTexto(con), sinIva: aTexto(con / (1 + IVA)) });
  }

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={value.normal}
          onChange={(e) => onChange({ ...value, normal: e.target.checked })}
        />
        <span>
          Facturación normal
          <span className="block text-[11px] text-[var(--color-text-muted)]">
            Se le factura todo el presupuesto. Si no, cargá cuánto se le factura y por qué.
          </span>
        </span>
      </label>
      {value.normal && (
        <div>
          <label className={labelCls}>Nota (opcional)</label>
          <input
            className={inputCls}
            value={value.motivo}
            onChange={(e) => onChange({ ...value, motivo: e.target.value })}
            placeholder="Ej: RUT o razón social a la que va la factura"
            maxLength={2000}
          />
        </div>
      )}
      {!value.normal && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Sin IVA (USD) *</label>
              <input className={inputCls} inputMode="decimal" value={value.sinIva} onChange={(e) => desdeSinIva(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>Con IVA (USD)</label>
              <input className={inputCls} inputMode="decimal" value={value.conIva} onChange={(e) => desdeConIva(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className={labelCls}>% del presupuesto</label>
              <input
                className={inputCls} inputMode="decimal" value={value.pct} onChange={(e) => desdePct(e.target.value)}
                placeholder={conPresupuesto ? 'Ej: 50' : 'Sin presupuesto'} disabled={!conPresupuesto}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Motivo *</label>
            <input
              className={inputCls}
              value={value.motivo}
              onChange={(e) => onChange({ ...value, motivo: e.target.value })}
              placeholder="Ej: descuento, una parte la financia el banco, a nombre de su empresa"
              maxLength={2000}
            />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">Con monto 0, el proyecto queda como que no lleva factura.</p>
        </>
      )}
    </div>
  );
}
