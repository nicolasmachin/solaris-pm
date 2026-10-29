import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { Sparkles } from 'lucide-react';

import { resolverBanco, type PendienteBanco, type SugerenciaBanco } from '../../api/bancoConciliacion.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';

// Debajo de un movimiento del banco que falta cargar: lo más parecido en
// Voltia PM (del más probable al menos, con el porqué) y lo que interpretó la
// IA. "Es este" registra lo que falta y lo deja emparejado con el banco.

export function invalidarBanco(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['banco-pendientes', 'banco-registro', 'banco-movimientos', 'por-conciliar', 'para-hacer-hoy', 'para-hacer-hoy-total',
    'finance-movements-tab', 'finance-movements', 'accounts-summary', 'cobros-by-project', 'fixed-costs-pending', 'facturas-recibidas', 'cuentas-por-pagar']) {
    qc.invalidateQueries({ queryKey: [k] });
  }
}

const TIPO: Record<SugerenciaBanco['tipo'], string> = {
  MOVIMIENTO: 'Ya cargado',
  DEUDA: 'Factura a pagar',
  DEUDA_PROVEEDOR: 'Deuda con el proveedor',
  COSTO_FIJO: 'Costo fijo',
  COBRO: 'Cobro previsto',
  FACTURA: 'Factura recibida',
};

function Opcion({ s, onElegir, ocupado }: { s: SugerenciaBanco; onElegir: () => void; ocupado: boolean }) {
  const fuerte = s.puntaje >= 75;
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={onElegir}
      title={s.accion}
      className="flex w-full items-start gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-left text-xs hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
    >
      <span className={`mt-0.5 shrink-0 rounded px-1 text-[9px] font-mono uppercase ${fuerte ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
        {fuerte ? 'Muy probable' : 'Probable'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[var(--color-text-primary)]">
          <span className="text-[var(--color-text-muted)]">{TIPO[s.tipo]}: </span>{s.titulo}
          {' · '}<span className="tabular-nums">{fmtCurrency(s.monto, s.moneda)}</span>
          {s.fecha && <span className="text-[var(--color-text-muted)]"> · {fmtDate(s.fecha)}</span>}
        </span>
        <span className="block text-[10px] text-[var(--color-text-muted)]">
          {[s.detalle, ...s.motivos].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="shrink-0 rounded bg-[var(--color-accent)] px-2 py-0.5 text-[11px] font-semibold text-gray-900">Es este</span>
    </button>
  );
}

export function SugerenciasBanco({ p }: { p: PendienteBanco }) {
  const qc = useQueryClient();
  const resolver = useMutation({
    mutationFn: (clave: string) => resolverBanco(p.id, clave),
    onSuccess: (r) => { toast.success(r.hecho.charAt(0).toUpperCase() + r.hecho.slice(1)); invalidarBanco(qc); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'No se pudo'),
  });
  const sug = p.sugerencias ?? [];
  const ia = p.sugerenciaIa;
  // Si la IA eligió una opción que ya está entre las sugerencias, no se repite.
  const iaOpcion = ia?.opcion && !sug.some((s) => s.clave === ia.opcion!.clave) ? ia.opcion : null;
  if (!sug.length && !ia) return null;
  return (
    <div className="mt-2 space-y-1.5 pl-0 sm:pl-24">
      {sug.map((s) => <Opcion key={s.clave} s={s} ocupado={resolver.isPending} onElegir={() => resolver.mutate(s.clave)} />)}
      {ia && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-violet-300">
            <Sparkles className="h-3 w-3" /> La IA cree{ia.confianza !== 'alta' ? ` (confianza ${ia.confianza})` : ''}:
          </span>{' '}
          <span className="text-[var(--color-text-secondary)]">{ia.queEs}</span>
          {iaOpcion && <div className="mt-1.5"><Opcion s={iaOpcion} ocupado={resolver.isPending} onElegir={() => resolver.mutate(iaOpcion.clave)} /></div>}
          {ia.opcion && !iaOpcion && <span className="text-[var(--color-text-muted)]"> (es la primera opción de arriba)</span>}
        </div>
      )}
    </div>
  );
}
