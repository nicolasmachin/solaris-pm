import { Button } from "../ui/Button";
import { NumberField, SelectField, TextAreaField, TextField } from "./fields";
import {
  isFlaggedValue,
  type ProposalDefaultsData,
  type ProposalDraftData,
  type ProposalItemAdicional,
} from "../../types/proposals-v2";

const SUB = "mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";

function newItem(): ProposalItemAdicional {
  return { id: crypto.randomUUID(), nombre: "", descripcion: "", precioSinIvaUsd: 0, potenciaW: undefined };
}

export function ProposalForm({
  data,
  onChange,
  defaults,
  errors,
}: {
  data: ProposalDraftData;
  onChange: (next: ProposalDraftData) => void;
  defaults: ProposalDefaultsData;
  errors: Record<string, string>;
}) {
  const setCliente = (p: Partial<ProposalDraftData["cliente"]>) => onChange({ ...data, cliente: { ...data.cliente, ...p } });
  const setFactura = (p: Partial<ProposalDraftData["factura"]>) => onChange({ ...data, factura: { ...data.factura, ...p } });
  const setTecho = (p: Partial<ProposalDraftData["techo"]>) => onChange({ ...data, techo: { ...data.techo, ...p } });
  const setCotiz = (p: Partial<ProposalDraftData["cotizacion"]>) => onChange({ ...data, cotizacion: { ...data.cotizacion, ...p } });
  const setSistema = (p: Partial<ProposalDraftData["sistema"]>) => onChange({ ...data, sistema: { ...data.sistema, ...p } });

  const canOverride = (key: string): boolean => {
    const v = defaults[key];
    return v && isFlaggedValue(v) ? v.asesorCanOverride : true;
  };
  const fixedHint = (key: string) => (canOverride(key) ? undefined : "Fijado por administración");

  const setItems = (items: ProposalItemAdicional[]) => onChange({ ...data, itemsAdicionales: items });
  const updateItem = (id: string, p: Partial<ProposalItemAdicional>) =>
    setItems(data.itemsAdicionales.map((it) => (it.id === id ? { ...it, ...p } : it)));

  return (
    <div className="space-y-8">
      {/* 1 · Cliente */}
      <section id="seccion-cliente" className="scroll-mt-28">
        <h2 className={H2}>Cliente</h2>
        <div className={GRID}>
          <TextField label="Nombre" value={data.cliente.nombre} onChange={(v) => setCliente({ nombre: v })} error={errors["cliente.nombre"]} />
          <TextField label="Ciudad" value={data.cliente.ciudad} onChange={(v) => setCliente({ ciudad: v })} error={errors["cliente.ciudad"]} />
          <TextField label="Dirigido a (opcional)" value={data.cliente.dirigidoA} onChange={(v) => setCliente({ dirigidoA: v })} placeholder="Estimado/a …," hint="Si lo dejás vacío, la carta dice “Estimado/a cliente,”." />
          <label className="block">
            <span className={labelCls}>Fecha de la propuesta</span>
            <input
              type="date"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              value={data.fecha}
              onChange={(e) => onChange({ ...data, fecha: e.target.value })}
            />
          </label>
        </div>
      </section>

      {/* 2 · Datos técnicos (incluye factura/consumo) */}
      <section id="seccion-tecnicos" className="scroll-mt-28">
        <h2 className={H2}>Datos técnicos del sistema</h2>

        <p className={SUB}>Factura / consumo actual</p>
        <div className={GRID}>
          <NumberField label="Paga por mes ($)" value={data.factura.pagaMensualPesos} onChange={(v) => setFactura({ pagaMensualPesos: v })} min={0} error={errors["factura.pagaMensualPesos"]} />
          <SelectField label="Tarifa" value={data.factura.tarifa} options={["Simple", "Doble", "Triple"] as const} onChange={(v) => setFactura({ tarifa: v })} />
          <SelectField label="Suministro" value={data.factura.suministro} options={["monofásico", "trifásico"] as const} onChange={(v) => setFactura({ suministro: v })} />
          <NumberField label="Potencia contratada (kW)" value={data.factura.potenciaContratadaKw} onChange={(v) => setFactura({ potenciaContratadaKw: v })} min={0} step={0.1} error={errors["factura.potenciaContratadaKw"]} />
        </div>

        <p className={SUB}>Sistema</p>
        <div className={GRID}>
          <NumberField label="Cantidad de paneles" value={data.sistema.cantidadPaneles} onChange={(v) => setSistema({ cantidadPaneles: v })} min={1} error={errors["sistema.cantidadPaneles"]} />
          <NumberField label="Potencia por panel (W)" value={data.sistema.potenciaPanelW} onChange={(v) => setSistema({ potenciaPanelW: v })} min={0} error={errors["sistema.potenciaPanelW"]} />
          <TextField label="Marca de paneles" value={data.sistema.marcaPaneles} onChange={(v) => setSistema({ marcaPaneles: v })} disabled={!canOverride("marcaPanelesDefault")} hint={fixedHint("marcaPanelesDefault")} error={errors["sistema.marcaPaneles"]} />
          <NumberField label="Potencia inversor (kW)" value={data.sistema.potenciaInversorKw} onChange={(v) => setSistema({ potenciaInversorKw: v })} min={0} step={0.1} error={errors["sistema.potenciaInversorKw"]} />
          <TextField label="Marca de inversor" value={data.sistema.marcaInversor} onChange={(v) => setSistema({ marcaInversor: v })} disabled={!canOverride("marcaInversorDefault")} hint={fixedHint("marcaInversorDefault")} error={errors["sistema.marcaInversor"]} />
          <TextField label="Tipo de montaje" value={data.sistema.tipoMontaje} onChange={(v) => setSistema({ tipoMontaje: v })} placeholder="Techo chapa / teja / suelo…" error={errors["sistema.tipoMontaje"]} />
        </div>

        <p className={SUB}>Techo</p>
        <div className={GRID}>
          <TextField label="Descripción del techo" value={data.techo.descripcion} onChange={(v) => setTecho({ descripcion: v })} error={errors["techo.descripcion"]} />
          <NumberField label="Tamaño (m²)" value={data.techo.tamanoM2} onChange={(v) => setTecho({ tamanoM2: v })} min={0} error={errors["techo.tamanoM2"]} />
        </div>
      </section>

      {/* 3 · Cotización A */}
      <section id="seccion-cotizacion" className="scroll-mt-28">
        <h2 className={H2}>Cotización base (Variante A)</h2>
        <div className={GRID}>
          <NumberField label="Cotización dólar" value={data.cotizacion.cotizacionDolar} onChange={(v) => setCotiz({ cotizacionDolar: v })} min={0} step={0.1} disabled={!canOverride("cotizacionDolarDefault")} hint={fixedHint("cotizacionDolarDefault")} error={errors["cotizacion.cotizacionDolar"]} />
          <NumberField label="Markup (0–1)" value={data.cotizacion.markupPorcentaje} onChange={(v) => setCotiz({ markupPorcentaje: v })} min={0} step={0.01} disabled={!canOverride("markupPorcentajeDefault")} hint={fixedHint("markupPorcentajeDefault")} error={errors["cotizacion.markupPorcentaje"]} />
          <NumberField label="Distancia instalación (km)" value={data.cotizacion.distanciaInstalacionKm} onChange={(v) => setCotiz({ distanciaInstalacionKm: v })} min={0} disabled={!canOverride("distanciaInstalacionKmDefault")} hint={fixedHint("distanciaInstalacionKmDefault")} error={errors["cotizacion.distanciaInstalacionKm"]} />
          <TextField label="Plazo de entrega" value={data.cotizacion.plazoEntrega} onChange={(v) => setCotiz({ plazoEntrega: v })} placeholder="6 a 8 semanas" error={errors["cotizacion.plazoEntrega"]} />
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">El precio final se calcula automáticamente a partir de estos datos.</p>
      </section>

      {/* 4 · Ítems adicionales (Variante B) */}
      <section id="seccion-items" className="scroll-mt-28">
        <h2 className={H2}>Ítems adicionales (Variante B)</h2>
        {data.itemsAdicionales.length === 0 ? (
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">
            Sin ítems adicionales. La propuesta muestra solo la Variante A. Agregá un ítem (por ej. baterías) para activar la Variante B.
          </p>
        ) : (
          <div className="mb-3 space-y-3">
            {data.itemsAdicionales.map((it) => (
              <div key={it.id} className="rounded-lg border border-[var(--color-border)] p-3">
                <div className={GRID}>
                  <TextField label="Nombre" value={it.nombre} onChange={(v) => updateItem(it.id, { nombre: v })} />
                  <NumberField label="Precio (USD, sin IVA)" value={it.precioSinIvaUsd} onChange={(v) => updateItem(it.id, { precioSinIvaUsd: v })} min={0} />
                  <TextField label="Descripción" value={it.descripcion} onChange={(v) => updateItem(it.id, { descripcion: v })} />
                  <NumberField label="Potencia (W, opcional)" value={it.potenciaW ?? 0} onChange={(v) => updateItem(it.id, { potenciaW: v || undefined })} min={0} />
                </div>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setItems(data.itemsAdicionales.filter((x) => x.id !== it.id))}>
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" variant="secondary" onClick={() => setItems([...data.itemsAdicionales, newItem()])}>
          Agregar ítem
        </Button>
      </section>

      {/* 5 · Financiación (read-only) */}
      <section id="seccion-financiacion" className="scroll-mt-28">
        <h2 className={H2}>Financiación</h2>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-sm text-[var(--color-text-secondary)]">
          Las cuotas de financiación (24, 36 y 60 meses) se calculan automáticamente sobre el total y aparecen en la propuesta. No requiere datos adicionales del asesor.
        </div>
      </section>

      {/* 6 · Notas */}
      <section id="seccion-notas" className="scroll-mt-28">
        <h2 className={H2}>Notas del asesor</h2>
        <TextAreaField label="Notas (opcional)" value={data.notas} onChange={(v) => onChange({ ...data, notas: v })} placeholder="Notas internas o aclaraciones para el cliente…" />
      </section>
    </div>
  );
}

const H2 = "mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]";
