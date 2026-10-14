import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Plus, Trash2, X } from 'lucide-react';

import { Spinner } from '../ui/Spinner';
import {
  emitirFactura, emitirNotaCredito, getBorradorFactura, getBorradorNotaCredito, revisarBorradorCfe,
  type BorradorCfe, type CfeEmitido, type EstadoEmisionBiller,
} from '../../api/finance.api';
import { fmtCurrency, fmtDate } from '../../lib/finance';

// Emitir una factura (o una nota de crédito) por Biller.
//
// Dos pasos a propósito: "Editar" arma el borrador con los datos del proyecto y
// deja corregir todo; "Revisar" muestra exactamente lo que se va a mandar y
// recién ahí se emite. Lo emitido no se edita: se corrige con nota de crédito.

type Props =
  | { modo: 'factura'; projectId: string; clientName: string; onClose: () => void }
  | { modo: 'nota-credito'; factura: CfeEmitido; projectId: string; clientName: string; onClose: () => void };

const inputCls =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none';
const labelCls = 'block text-[11px] font-medium text-[var(--color-text-muted)] mb-1';

function errorMsg(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function EmitirCfeModal(props: Props) {
  const queryClient = useQueryClient();
  const esNC = props.modo === 'nota-credito';
  const facturaId = esNC ? props.factura.id : null;

  const [borrador, setBorrador] = useState<BorradorCfe | null>(null);
  const [emision, setEmision] = useState<EstadoEmisionBiller | null>(null);
  const [razonSocialDgi, setRazonSocialDgi] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mandarMail, setMandarMail] = useState(false);
  const [paso, setPaso] = useState<'editar' | 'revisar'>('editar');
  const [problemas, setProblemas] = useState<string[]>([]);
  const [revisado, setRevisado] = useState(false);
  // Nota de crédito: total (anula la factura) o parcial (por un monto).
  const [ncTipo, setNcTipo] = useState<'total' | 'parcial'>('total');
  const [ncMonto, setNcMonto] = useState('');
  const [disponible, setDisponible] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const carga = esNC
      ? getBorradorNotaCredito(facturaId!).then((r) => {
          if (!vivo) return;
          setBorrador(r.borrador);
          setEmision(r.emision);
          setDisponible(r.disponible);
        })
      : getBorradorFactura(props.projectId).then((r) => {
          if (!vivo) return;
          setBorrador(r.borrador);
          setEmision(r.emision);
          setRazonSocialDgi(r.razonSocialDgi);
          setNota(r.nota);
          setMandarMail(!!r.borrador.emailCliente);
        });
    carga
      .catch((err) => { toast.error(errorMsg(err, 'No se pudo armar el borrador')); props.onClose(); })
      .finally(() => vivo && setCargando(false));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parcial: un renglón por el monto (con IVA). Total: lo que arma el servidor.
  async function aplicarMontoNC(tipo: 'total' | 'parcial', monto: string) {
    if (!facturaId) return;
    const n = Number(monto.replace(',', '.'));
    if (tipo === 'parcial' && !(n > 0)) return;
    const r = await getBorradorNotaCredito(facturaId, tipo === 'parcial' ? n : undefined);
    setBorrador((prev) => ({ ...r.borrador, motivo: prev?.motivo ?? null }));
  }

  const total = useMemo(
    () => (borrador ? redondear(borrador.items.reduce((a, i) => a + i.cantidad * i.precio, 0)) : 0),
    [borrador],
  );
  // Desglose aproximado para mostrar (Biller hace el cálculo oficial).
  const ivaBasico = useMemo(() => {
    if (!borrador) return 0;
    const gravado = borrador.items.filter((i) => i.indicadorFacturacion === 3).reduce((a, i) => a + i.cantidad * i.precio, 0);
    return redondear(gravado - gravado / 1.22);
  }, [borrador]);

  const borradorAEnviar = (): BorradorCfe | null =>
    borrador ? { ...borrador, emailCliente: mandarMail ? borrador.emailCliente : null } : null;

  const revisarMutation = useMutation({
    mutationFn: () => revisarBorradorCfe(borradorAEnviar()!),
    onSuccess: (r) => {
      setProblemas(r.problemas);
      if (r.problemas.length === 0) { setPaso('revisar'); setRevisado(false); }
    },
    onError: (err) => toast.error(errorMsg(err, 'Revisá los datos: hay campos incompletos')),
  });

  const emitirMutation = useMutation({
    mutationFn: () => {
      const b = borradorAEnviar()!;
      return esNC ? emitirNotaCredito(facturaId!, b) : emitirFactura(props.projectId, b);
    },
    onSuccess: ({ cfe }) => {
      queryClient.invalidateQueries({ queryKey: ['facturacion'] });
      queryClient.invalidateQueries({ queryKey: ['cfes', props.projectId] });
      if (cfe.estado === 'DUDOSO') {
        toast('Biller no respondió a tiempo. Se está verificando si se emitió: no lo vuelvas a emitir.', { icon: '⏳', duration: 8000 });
      } else {
        toast.success(`${cfe.tipoLabel} ${cfe.serie}-${cfe.numero} emitida. DGI responde en unos minutos.`);
      }
      props.onClose();
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['facturacion'] });
      toast.error(errorMsg(err, 'No se pudo emitir'), { duration: 8000 });
    },
  });

  function setCliente<K extends keyof BorradorCfe['cliente']>(k: K, v: BorradorCfe['cliente'][K]) {
    setBorrador((b) => (b ? { ...b, cliente: { ...b.cliente, [k]: v } } : b));
  }
  function setItem(i: number, patch: Partial<BorradorCfe['items'][number]>) {
    setBorrador((b) => (b ? { ...b, items: b.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : b));
  }

  const titulo = esNC ? 'Nota de crédito' : 'Emitir factura';
  const etiquetaTipo = borrador
    ? ({ 101: 'e-Ticket', 111: 'e-Factura', 102: 'Nota de crédito de e-Ticket', 112: 'Nota de crédito de e-Factura' } as const)[borrador.tipoCfe]
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-6">
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
              {titulo} · {paso === 'editar' ? 'paso 1 de 2: datos' : 'paso 2 de 2: confirmar'}
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{props.clientName}</p>
          </div>
          <button onClick={props.onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {cargando || !borrador ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <>
              {emision?.ambiente === 'TEST' && (
                <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[12px] text-sky-200">
                  Ambiente de prueba de Biller: el comprobante no tiene valor fiscal y no se le manda nada al cliente.
                </div>
              )}
              {emision && !emision.habilitada && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                  No se puede emitir: {emision.motivo}
                </div>
              )}

              {paso === 'editar' ? (
                <>
                  {nota && (
                    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)] whitespace-pre-wrap">
                      <span className="font-semibold">Nota de facturación:</span> {nota}
                    </div>
                  )}

                  {esNC && props.modo === 'nota-credito' && (
                    <div className="space-y-2">
                      <p className="text-[12px] text-[var(--color-text-secondary)]">
                        Corrige la {props.factura.tipoLabel} {props.factura.serie}-{props.factura.numero} por{' '}
                        {fmtCurrency(props.factura.total, props.factura.moneda)}
                        {disponible != null && disponible < props.factura.total && <> (quedan {fmtCurrency(disponible, props.factura.moneda)} sin acreditar)</>}.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked={ncTipo === 'total'} onChange={() => { setNcTipo('total'); aplicarMontoNC('total', ''); }} />
                          Total (anula la factura)
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked={ncTipo === 'parcial'} onChange={() => setNcTipo('parcial')} />
                          Parcial, por
                        </label>
                        {ncTipo === 'parcial' && (
                          <input
                            className={`${inputCls} w-32`}
                            inputMode="decimal"
                            placeholder="Monto con IVA"
                            value={ncMonto}
                            onChange={(e) => setNcMonto(e.target.value)}
                            onBlur={() => aplicarMontoNC('parcial', ncMonto)}
                          />
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Motivo (queda registrado)</label>
                        <input
                          className={inputCls}
                          value={borrador.motivo ?? ''}
                          onChange={(e) => setBorrador({ ...borrador, motivo: e.target.value })}
                          placeholder="Ej.: descuento acordado, error en el monto, se anula la venta"
                        />
                      </div>
                    </div>
                  )}

                  {!esNC && (
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={borrador.tipoCfe === 101}
                          onChange={() => setBorrador({ ...borrador, tipoCfe: 101, cliente: { ...borrador.cliente, tipoDocumento: 3 } })}
                        />
                        e-Ticket (persona, con cédula)
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          checked={borrador.tipoCfe === 111}
                          onChange={() => setBorrador({ ...borrador, tipoCfe: 111, cliente: { ...borrador.cliente, tipoDocumento: 2 } })}
                        />
                        e-Factura (empresa, con RUT)
                      </label>
                    </div>
                  )}

                  <fieldset disabled={esNC} className="grid grid-cols-1 sm:grid-cols-2 gap-3 disabled:opacity-70">
                    <div>
                      <label className={labelCls}>{borrador.cliente.tipoDocumento === 2 ? 'RUT' : 'Cédula'}</label>
                      <input className={inputCls} value={borrador.cliente.documento} onChange={(e) => setCliente('documento', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>{borrador.cliente.tipoDocumento === 2 ? 'Razón social' : 'Nombre'}</label>
                      <input className={inputCls} value={borrador.cliente.nombre} onChange={(e) => setCliente('nombre', e.target.value)} />
                      {razonSocialDgi && razonSocialDgi !== borrador.cliente.nombre && (
                        <button type="button" onClick={() => setCliente('nombre', razonSocialDgi)} className="mt-1 text-[11px] text-[var(--color-accent)] hover:underline">
                          Usar la de DGI: {razonSocialDgi}
                        </button>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Dirección</label>
                      <input className={inputCls} maxLength={70} value={borrador.cliente.direccion} onChange={(e) => setCliente('direccion', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Ciudad</label>
                      <input className={inputCls} maxLength={30} value={borrador.cliente.ciudad} onChange={(e) => setCliente('ciudad', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Departamento</label>
                      <input className={inputCls} maxLength={30} value={borrador.cliente.departamento} onChange={(e) => setCliente('departamento', e.target.value)} />
                    </div>
                  </fieldset>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Fecha de emisión</label>
                      <input type="date" className={inputCls} value={borrador.fechaEmision} onChange={(e) => setBorrador({ ...borrador, fechaEmision: e.target.value })} />
                    </div>
                    {!esNC && (
                      <>
                        <div>
                          <label className={labelCls}>Forma de pago</label>
                          <select
                            className={inputCls}
                            value={borrador.formaPago}
                            onChange={(e) => setBorrador({ ...borrador, formaPago: Number(e.target.value) as 1 | 2 })}
                          >
                            <option value={1}>Contado</option>
                            <option value={2}>Crédito</option>
                          </select>
                        </div>
                        {borrador.formaPago === 2 && (
                          <div>
                            <label className={labelCls}>Vencimiento</label>
                            <input type="date" className={inputCls} value={borrador.fechaVencimiento ?? ''} onChange={(e) => setBorrador({ ...borrador, fechaVencimiento: e.target.value || null })} />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className={labelCls}>Renglones (precios con IVA incluido, en {borrador.moneda})</p>
                    {borrador.items.map((it, i) => (
                      <div key={i} className="grid grid-cols-[1fr_70px_110px_auto] gap-2 items-start">
                        <input className={inputCls} maxLength={80} value={it.concepto} onChange={(e) => setItem(i, { concepto: e.target.value })} />
                        <input className={inputCls} inputMode="decimal" value={it.cantidad} disabled={esNC} onChange={(e) => setItem(i, { cantidad: Number(e.target.value.replace(',', '.')) || 0 })} title="Cantidad" />
                        <input className={inputCls} inputMode="decimal" value={it.precio} disabled={esNC} onChange={(e) => setItem(i, { precio: Number(e.target.value.replace(',', '.')) || 0 })} title="Precio con IVA" />
                        {!esNC && borrador.items.length > 1 ? (
                          <button type="button" onClick={() => setBorrador({ ...borrador, items: borrador.items.filter((_, j) => j !== i) })} className="p-1.5 text-[var(--color-text-muted)] hover:text-red-400" aria-label="Quitar renglón">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : <span />}
                      </div>
                    ))}
                    {!esNC && (
                      <button
                        type="button"
                        onClick={() => setBorrador({ ...borrador, items: [...borrador.items, { concepto: '', descripcion: null, cantidad: 1, precio: 0, indicadorFacturacion: 3 }] })}
                        className="flex items-center gap-1 text-[12px] text-[var(--color-accent)] hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> Agregar renglón
                      </button>
                    )}
                    <div className="text-right text-[12px] text-[var(--color-text-secondary)] tabular-nums">
                      Neto {fmtCurrency(redondear(total - ivaBasico), borrador.moneda)} · IVA 22 % {fmtCurrency(ivaBasico, borrador.moneda)} ·{' '}
                      <span className="font-semibold text-[var(--color-text-primary)]">Total {fmtCurrency(total, borrador.moneda)}</span>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Adenda (texto libre que sale en el comprobante)</label>
                    <input className={inputCls} value={borrador.adenda ?? ''} onChange={(e) => setBorrador({ ...borrador, adenda: e.target.value || null })} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <input type="checkbox" checked={mandarMail} onChange={(e) => setMandarMail(e.target.checked)} />
                      Que Biller le mande el PDF al cliente por mail
                    </label>
                    {mandarMail && (
                      <input
                        className={inputCls}
                        type="email"
                        value={borrador.emailCliente ?? ''}
                        onChange={(e) => setBorrador({ ...borrador, emailCliente: e.target.value || null })}
                        placeholder="mail del cliente"
                      />
                    )}
                  </div>

                  {problemas.length > 0 && (
                    <ul className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200 list-disc pl-6">
                      {problemas.map((p) => <li key={p}>{p}</li>)}
                    </ul>
                  )}
                </>
              ) : (
                <Resumen borrador={borradorAEnviar()!} etiquetaTipo={etiquetaTipo} total={total} iva={ivaBasico} />
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-3">
          {paso === 'revisar' ? (
            <>
              <label className="flex items-start gap-2 text-[12px] text-[var(--color-text-secondary)] max-w-sm">
                <input type="checkbox" className="mt-0.5" checked={revisado} onChange={(e) => setRevisado(e.target.checked)} />
                Revisé los datos. Lo emitido llega a DGI y no se puede editar: solo se corrige con una nota de crédito.
              </label>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setPaso('editar')} disabled={emitirMutation.isPending} className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                  Volver
                </button>
                <button
                  onClick={() => emitirMutation.mutate()}
                  disabled={!revisado || emitirMutation.isPending || !emision?.habilitada}
                  className="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-gray-900 text-sm font-semibold disabled:opacity-50"
                >
                  {emitirMutation.isPending ? 'Emitiendo…' : `Emitir ${etiquetaTipo}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <span />
              <div className="flex gap-2">
                <button onClick={props.onClose} className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                  Cancelar
                </button>
                <button
                  onClick={() => revisarMutation.mutate()}
                  disabled={!borrador || revisarMutation.isPending || (esNC && !borrador.motivo?.trim())}
                  className="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-gray-900 text-sm font-semibold disabled:opacity-50"
                >
                  {revisarMutation.isPending ? 'Revisando…' : 'Revisar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Resumen({ borrador: b, etiquetaTipo, total, iva }: { borrador: BorradorCfe; etiquetaTipo: string; total: number; iva: number }) {
  const fila = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1 border-b border-[var(--color-border)] last:border-0">
      <span className="text-[12px] text-[var(--color-text-muted)]">{k}</span>
      <span className="text-sm text-[var(--color-text-primary)]">{v}</span>
    </div>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        Esto es exactamente lo que se le va a mandar a Biller.
      </div>
      <div>
        {fila('Comprobante', etiquetaTipo)}
        {fila(b.cliente.tipoDocumento === 2 ? 'RUT' : 'Cédula', b.cliente.documento)}
        {fila(b.cliente.tipoDocumento === 2 ? 'Razón social' : 'Nombre', b.cliente.nombre)}
        {fila('Dirección', `${b.cliente.direccion}, ${b.cliente.ciudad}, ${b.cliente.departamento}`)}
        {fila('Fecha de emisión', fmtDate(b.fechaEmision))}
        {b.tipoCfe === 101 || b.tipoCfe === 111
          ? fila('Forma de pago', b.formaPago === 1 ? 'Contado' : `Crédito, vence ${b.fechaVencimiento ? fmtDate(b.fechaVencimiento) : '—'}`)
          : null}
        {fila('Moneda', `${b.moneda} (tasa del cierre del día anterior)`)}
        {b.motivo && fila('Motivo', b.motivo)}
        {b.adenda && fila('Adenda', b.adenda)}
        {fila('Mail al cliente', b.emailCliente ?? 'No se manda')}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-[var(--color-text-muted)]">
            <th className="text-left font-medium">Concepto</th>
            <th className="text-right font-medium">Cant.</th>
            <th className="text-right font-medium">Precio c/IVA</th>
          </tr>
        </thead>
        <tbody>
          {b.items.map((i, k) => (
            <tr key={k} className="text-[var(--color-text-primary)]">
              <td className="py-1">{i.concepto}</td>
              <td className="py-1 text-right tabular-nums">{i.cantidad}</td>
              <td className="py-1 text-right tabular-nums">{fmtCurrency(i.precio, b.moneda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-right text-sm tabular-nums text-[var(--color-text-secondary)]">
        Neto {fmtCurrency(redondear(total - iva), b.moneda)} · IVA 22 % {fmtCurrency(iva, b.moneda)} ·{' '}
        <span className="font-bold text-[var(--color-text-primary)]">Total {fmtCurrency(total, b.moneda)}</span>
      </div>
    </div>
  );
}
