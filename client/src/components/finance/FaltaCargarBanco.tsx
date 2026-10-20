import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AlertTriangle, ChevronDown, ChevronRight, Landmark, Plus } from 'lucide-react';

import { getPendientesBanco, marcarNoVaBanco, type CuentaConciliada, type PendienteBanco } from '../../api/bancoConciliacion.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';
import { usePermission } from '../../hooks/usePermission';

// Cuadro "Falta cargar" de Movimientos: lo que el lector del banco vio en eBROU
// y no encuentra en Voltia PM. "Cargar" abre el formulario de nuevo movimiento
// ya completado; al guardarlo, la comparación lo empareja sola.

// Pasadas 30 horas sin lectura, el robot se saltó al menos una corrida.
const HORAS_LECTURA_VIEJA = 30;

function leidoHace(iso: string | null) {
  if (!iso) return { texto: 'Todavía no se leyó', viejo: true };
  const d = new Date(iso);
  const horas = (Date.now() - d.getTime()) / 36e5;
  const hora = d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
  const dia = horas < 24 && d.getDate() === new Date().getDate() ? 'hoy' : fmtDate(iso.slice(0, 10));
  return { texto: `Leído ${dia} a las ${hora}`, viejo: horas > HORAS_LECTURA_VIEJA };
}

export type CargarDesdeBanco = {
  accountId: string;
  tipo: PendienteBanco['tipo'];
  fecha: string;
  descripcion: string;
  monto: string;
  moneda: CuentaConciliada['moneda'];
};

export function FaltaCargarBanco({ onCargar }: { onCargar: (p: CargarDesdeBanco) => void }) {
  const qc = useQueryClient();
  const puedeEditar = usePermission('FINANZAS', 'EDIT');
  const [abierto, setAbierto] = useState(true);
  const [noVa, setNoVa] = useState<{ id: string; motivo: string } | null>(null);

  const { data: cuentas = [] } = useQuery({ queryKey: ['banco-pendientes'], queryFn: getPendientesBanco });

  const noVaMut = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => marcarNoVaBanco(id, motivo),
    onSuccess: () => {
      toast.success('Marcado como "No va"');
      setNoVa(null);
      qc.invalidateQueries({ queryKey: ['banco-pendientes'] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'No se pudo marcar');
    },
  });

  if (cuentas.length === 0) return null;
  const total = cuentas.reduce((n, c) => n + c.pendientes.length, 0);

  return (
    <div className={`rounded-xl border ${total ? 'border-amber-500/40' : 'border-[var(--color-border)]'} bg-[var(--color-bg-card)]`}>
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Landmark className="h-4 w-4 text-[var(--color-text-muted)]" />
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {total ? `Falta cargar: ${total} movimiento${total === 1 ? '' : 's'} del banco` : 'Banco al día: todo lo del banco está cargado'}
        </span>
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-[var(--color-border)] px-4 py-3">
          {cuentas.map((c) => {
            const lectura = leidoHace(c.bancoLeidoEn);
            return (
              <div key={c.accountId}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{c.nombre}</span>
                  <span className={lectura.viejo ? 'inline-flex items-center gap-1 text-amber-400' : ''}>
                    {lectura.viejo && <AlertTriangle className="h-3 w-3" />}
                    {lectura.texto}
                  </span>
                  {c.bancoSaldo != null && <span>Saldo en el banco {fmtCurrency(c.bancoSaldo, c.moneda)}</span>}
                  <span>{c.conciliados} coinciden · margen {fmtCurrency(c.margen, c.moneda)}</span>
                </div>
                {c.pendientes.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Nada pendiente en esta cuenta.</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
                    {c.pendientes.map((p) => (
                      <li key={p.id} className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="tabular-nums text-[var(--color-text-secondary)]">{fmtDate(p.fecha)}</span>
                          <span className="min-w-0 flex-1 text-[var(--color-text-primary)]">
                            {p.descripcion}
                            {p.documento && <span className="ml-1 text-[11px] text-[var(--color-text-muted)]">doc. {p.documento}</span>}
                          </span>
                          <span className={`tabular-nums font-semibold ${p.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                            {p.tipo === 'INGRESO' ? '+' : '-'}{fmtCurrency(p.monto, c.moneda)}
                          </span>
                          {puedeEditar && (
                            <span className="inline-flex gap-1">
                              <button
                                onClick={() => onCargar({ accountId: c.accountId, tipo: p.tipo, fecha: p.fecha, descripcion: p.descripcion, monto: String(p.monto), moneda: c.moneda })}
                                className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-gray-900 hover:bg-[var(--color-accent-hover)]"
                              >
                                <Plus className="h-3 w-3" /> Cargar
                              </button>
                              <button
                                onClick={() => setNoVa({ id: p.id, motivo: '' })}
                                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                              >
                                No va
                              </button>
                            </span>
                          )}
                        </div>
                        {noVa?.id === p.id && (
                          <form
                            className="mt-2 flex flex-wrap gap-2"
                            onSubmit={(e) => { e.preventDefault(); noVaMut.mutate(noVa); }}
                          >
                            <input
                              autoFocus
                              value={noVa.motivo}
                              onChange={(e) => setNoVa({ ...noVa, motivo: e.target.value })}
                              placeholder="Por qué no se carga (ej. ya está en otra cuenta)"
                              className="min-w-[220px] flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                            />
                            <button
                              type="submit"
                              disabled={noVa.motivo.trim().length < 3 || noVaMut.isPending}
                              className="rounded bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-gray-900 disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                            <button type="button" onClick={() => setNoVa(null)} className="px-2 py-1 text-xs text-[var(--color-text-muted)]">
                              Cancelar
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
