import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { CheckCircle2, Circle, Download } from 'lucide-react';

import { Spinner } from '../components/ui/Spinner';
import { cerrarMes, descargarArchivoCierre, getCierres, getControlCierre, reabrirMes } from '../api/finance.api';
import { usePermission } from '../hooks/usePermission';
import { fmtCurrency, MONTH_NAMES } from '../lib/finance';

// Cierre de mes: la lista de control (lo que se calcula solo y lo que tilda una
// persona), el archivo para la contadora y el cierre. Un mes cerrado no cambia:
// nada con fecha de ese mes se carga, edita ni borra. Reabrir queda registrado.

function apiErr(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function mesAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

const card = 'rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4';
const sel = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]';

export function FinanceCierreTab() {
  const qc = useQueryClient();
  const canCerrar = usePermission('FINANZAS', 'COMPLETE');
  const [periodo, setPeriodo] = useState(mesAnterior);
  const [manuales, setManuales] = useState<Set<string>>(new Set());
  const [nota, setNota] = useState('');

  const { data: cierres } = useQuery({ queryKey: ['cierres'], queryFn: getCierres });
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['cierre-control', periodo.anio, periodo.mes],
    queryFn: () => getControlCierre(periodo.anio, periodo.mes),
  });
  useEffect(() => { setManuales(new Set()); setNota(''); }, [periodo.anio, periodo.mes]);

  const cerradoActual = cierres?.cierres.find((c) => c.anio === periodo.anio && c.mes === periodo.mes && !c.reabiertoAt);
  const itemsConTildes = items.map((i) => (i.manual ? { ...i, ok: manuales.has(i.clave) } : i));
  const pendientes = itemsConTildes.filter((i) => !i.ok).length;

  const cerrar = useMutation({
    mutationFn: () => cerrarMes({ ...periodo, manuales: [...manuales], ...(nota.trim() ? { nota: nota.trim() } : {}) }),
    onSuccess: () => {
      toast.success(`${MONTH_NAMES[periodo.mes - 1]} ${periodo.anio} cerrado`);
      qc.invalidateQueries({ queryKey: ['cierres'] });
    },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo cerrar'),
  });
  const reabrir = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => reabrirMes(id, motivo),
    onSuccess: () => { toast.success('Mes reabierto'); qc.invalidateQueries({ queryKey: ['cierres'] }); },
    onError: (e) => toast.error(apiErr(e) ?? 'No se pudo reabrir'),
  });

  const anios = [periodo.anio - 1, periodo.anio, periodo.anio + 1].filter((a) => a <= new Date().getFullYear());

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Cerrar un mes lo deja fijo: nada con fecha de ese mes se puede cargar, editar ni borrar, y los números de
        ese mes no se mueven más. Antes de cerrar, se revisa la lista y se baja el archivo para la contadora.
        {cierres?.fechaCierre && <> Hoy está cerrado hasta el <b>{cierres.fechaCierre.split('-').reverse().join('/')}</b>.</>}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={periodo.mes} onChange={(e) => setPeriodo((p) => ({ ...p, mes: Number(e.target.value) }))}>
          {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className={sel} value={periodo.anio} onChange={(e) => setPeriodo((p) => ({ ...p, anio: Number(e.target.value) }))}>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
          onClick={() => descargarArchivoCierre(periodo.anio, periodo.mes).catch(() => toast.error('No se pudo bajar el archivo'))}>
          <Download className="h-4 w-4" /> Archivo para la contadora
        </button>
      </div>

      {cerradoActual ? (
        <div className={card}>
          <p className="text-sm font-semibold text-emerald-300">
            {MONTH_NAMES[periodo.mes - 1]} {periodo.anio} está cerrado
          </p>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            Lo cerró {cerradoActual.cerradoPor} el {new Date(cerradoActual.cerradoAt).toLocaleString('es-UY')}
            {cerradoActual.notaCierre ? ` · "${cerradoActual.notaCierre}"` : ''}
          </p>
          {cerradoActual.foto?.caja?.length > 0 && (
            <p className="mt-2 text-[12px] text-[var(--color-text-secondary)]">
              Caja al cerrar: {cerradoActual.foto.caja.map((c) => `${c.cuenta} ${fmtCurrency(c.saldo, c.moneda)}`).join(' · ')}
            </p>
          )}
          {canCerrar && (
            <button className="mt-3 text-[12px] text-[var(--color-accent)] hover:underline" disabled={reabrir.isPending}
              onClick={() => {
                const motivo = window.prompt('¿Por qué se reabre? (queda registrado)');
                if (motivo && motivo.trim().length >= 10) reabrir.mutate({ id: cerradoActual.id, motivo: motivo.trim() });
                else if (motivo) toast.error('El motivo tiene que tener al menos 10 letras');
              }}>
              Reabrir este mes
            </button>
          )}
        </div>
      ) : (
        <div className={card}>
          <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Lista de control de {MONTH_NAMES[periodo.mes - 1]} {periodo.anio}</p>
          {isLoading ? <Spinner /> : (
            <ul className="space-y-2">
              {itemsConTildes.map((i) => (
                <li key={i.clave} className="flex items-start gap-2 text-sm">
                  {i.manual ? (
                    <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={i.ok} disabled={!canCerrar}
                      onChange={(e) => setManuales((prev) => { const n = new Set(prev); if (e.target.checked) n.add(i.clave); else n.delete(i.clave); return n; })} />
                  ) : i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
                  <span className={i.ok ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}>
                    {i.texto}
                    {i.detalle && <span className="block text-[11px] text-amber-300">{i.detalle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canCerrar ? (
            <div className="mt-4 space-y-2">
              {pendientes > 0 && (
                <textarea className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm" rows={2}
                  value={nota} onChange={(e) => setNota(e.target.value)}
                  placeholder={`Quedan ${pendientes} punto(s) sin resolver. Para cerrar igual, escribí por qué.`} />
              )}
              <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-50"
                disabled={cerrar.isPending || (pendientes > 0 && nota.trim().length < 10)}
                onClick={() => cerrar.mutate()}>
                {cerrar.isPending ? 'Cerrando…' : `Cerrar ${MONTH_NAMES[periodo.mes - 1]} ${periodo.anio}`}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">Cerrar el mes lo hace quien tiene el permiso de cierre de Finanzas.</p>
          )}
        </div>
      )}

      {cierres && cierres.cierres.length > 0 && (
        <div className={card}>
          <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Historial de cierres</p>
          <ul className="space-y-1 text-[12px] text-[var(--color-text-secondary)]">
            {cierres.cierres.map((c) => (
              <li key={c.id}>
                {MONTH_NAMES[c.mes - 1]} {c.anio} · cerrado por {c.cerradoPor} el {new Date(c.cerradoAt).toLocaleDateString('es-UY')}
                {c.reabiertoAt && <span className="text-amber-300"> · reabierto por {c.reabiertoPor} el {new Date(c.reabiertoAt).toLocaleDateString('es-UY')}: {c.motivoReapertura}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
