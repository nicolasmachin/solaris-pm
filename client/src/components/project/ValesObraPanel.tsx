import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getConsumoObra, registrarValeObra, type FilaConsumoObra } from '../../api/stock.api';
import { usePermission } from '../../hooks/usePermission';

type Tipo = 'SALIDA' | 'DEVOLUCION';

const fmt = (n: number) => n.toLocaleString('es-UY', { maximumFractionDigits: 2 });
const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Lo que salió del local para esta obra, lo que volvió sobrante y el consumo
 * resultante, contra la lista de materiales. Opcional: ninguna etapa lo exige
 * todavía (decisión del 10-oct-2026), queda listo para cuando se use.
 */
export function ValesObraPanel({ projectId }: { projectId: string }) {
  const canCreate = usePermission('STOCK', 'CREATE');
  const [abierto, setAbierto] = useState<Tipo | null>(null);

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['consumo-obra', projectId],
    queryFn: () => getConsumoObra(projectId),
  });

  const hayMovimientos = filas.some((f) => f.salio > 0 || f.volvio > 0);

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Salida y devolución de materiales</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Consumo = lo que salió del local menos lo que volvió. Por ahora es opcional.
          </p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <button
              onClick={() => setAbierto('SALIDA')}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
            >
              Vale de salida
            </button>
            <button
              onClick={() => setAbierto('DEVOLUCION')}
              disabled={!filas.some((f) => f.salio - f.volvio > 0)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/20 disabled:opacity-40"
            >
              Vale de devolución
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : !filas.length ? (
        <p className="text-xs text-[var(--color-text-muted)]">La obra todavía no tiene lista de materiales.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                <th className="py-1.5 text-left font-medium">Material</th>
                <th className="py-1.5 text-right font-medium">Planificado</th>
                <th className="py-1.5 text-right font-medium">Salió</th>
                <th className="py-1.5 text-right font-medium">Volvió</th>
                <th className="py-1.5 text-right font-medium">Consumo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const desvio = hayMovimientos && f.salio > 0 && Math.abs(f.consumo - f.planificado) > 0.001;
                return (
                  <tr key={f.materialItemId} className="border-b border-[var(--color-border)]/50">
                    <td className="py-1.5 text-[var(--color-text-primary)]">
                      {f.nombre} <span className="text-[var(--color-text-muted)]">{f.unidad}</span>
                    </td>
                    <td className="py-1.5 text-right">{fmt(f.planificado)}</td>
                    <td className="py-1.5 text-right">{f.salio ? fmt(f.salio) : '—'}</td>
                    <td className="py-1.5 text-right">{f.volvio ? fmt(f.volvio) : '—'}</td>
                    <td className={`py-1.5 text-right font-semibold ${desvio ? 'text-orange-400' : ''}`}>
                      {f.salio || f.volvio ? fmt(f.consumo) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {abierto && (
        <ValeModal projectId={projectId} tipo={abierto} filas={filas} onClose={() => setAbierto(null)} />
      )}
    </div>
  );
}

function ValeModal({
  projectId,
  tipo,
  filas,
  onClose,
}: {
  projectId: string;
  tipo: Tipo;
  filas: FilaConsumoObra[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  // Salida: propone lo que falta sacar según la lista. Devolución: arranca en 0
  // y solo ofrece lo que está afuera.
  const opciones =
    tipo === 'SALIDA' ? filas.filter((f) => f.planificado > 0) : filas.filter((f) => f.salio - f.volvio > 0);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      opciones.map((f) => [f.materialItemId, tipo === 'SALIDA' ? String(Math.max(0, f.planificado - f.salio)) : '0']),
    ),
  );
  const [fecha, setFecha] = useState(hoy());
  const [observaciones, setObservaciones] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      registrarValeObra(projectId, {
        tipo,
        fecha,
        observaciones: observaciones.trim() || undefined,
        renglones: Object.entries(cantidades)
          .map(([materialItemId, v]) => ({ materialItemId, cantidad: Number(v.replace(',', '.')) }))
          .filter((r) => Number.isFinite(r.cantidad) && r.cantidad > 0),
      }),
    onSuccess: (r) => {
      toast.success(`${tipo === 'SALIDA' ? 'Vale de salida' : 'Vale de devolución'} registrado: ${r.renglones} materiales`);
      qc.invalidateQueries({ queryKey: ['consumo-obra', projectId] });
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'No se pudo registrar el vale');
    },
  });

  const hayAlgo = Object.values(cantidades).some((v) => Number(v.replace(',', '.')) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-semibold text-[var(--color-text-primary)]">
          {tipo === 'SALIDA' ? 'Vale de salida a la obra' : 'Vale de devolución de sobrantes'}
        </p>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          {tipo === 'SALIDA'
            ? 'Lo que se carga en el local para esta obra. Viene propuesto lo que falta sacar según la lista; se corrige lo que haga falta.'
            : 'Lo que volvió de la obra al local. Se carga solo lo que volvió.'}
        </p>

        <label className="mb-3 block text-xs text-[var(--color-text-muted)]">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 block rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-sm text-[var(--color-text-primary)]"
          />
        </label>

        <div className="space-y-1.5">
          {opciones.map((f) => (
            <div key={f.materialItemId} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-[var(--color-text-primary)]">
                {f.nombre}
                <span className="ml-1 text-[var(--color-text-muted)]">
                  {tipo === 'SALIDA'
                    ? `(lista: ${fmt(f.planificado)}, ya salió: ${fmt(f.salio)})`
                    : `(afuera: ${fmt(f.salio - f.volvio)})`}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <input
                  inputMode="decimal"
                  value={cantidades[f.materialItemId] ?? ''}
                  onChange={(e) => setCantidades((c) => ({ ...c, [f.materialItemId]: e.target.value }))}
                  className="w-20 rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-right text-[var(--color-text-primary)]"
                />
                <span className="w-10 text-[var(--color-text-muted)]">{f.unidad}</span>
              </span>
            </div>
          ))}
        </div>

        <textarea
          placeholder="Observaciones (opcional)"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          className="mt-3 w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-primary)]"
          rows={2}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!hayAlgo || mutation.isPending}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {mutation.isPending ? 'Registrando…' : 'Registrar vale'}
          </button>
        </div>
      </div>
    </div>
  );
}
