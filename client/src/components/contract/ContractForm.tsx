import { NumberField, TextAreaField, TextField } from "../proposals-v2/fields";
import type { ContractData } from "../../types/contract";

const H2 = "text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]";
const SUB = "mb-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2";

// Formulario del contrato (columna izquierda del generador). Secciones con
// id="seccion-*" para el scroll a faltantes del PublishButton.
export function ContractForm({
  data,
  onChange,
  errors,
}: {
  data: ContractData;
  onChange: (next: ContractData) => void;
  errors: Record<string, string>;
}) {
  const setCliente = (p: Partial<ContractData["cliente"]>) => onChange({ ...data, cliente: { ...data.cliente, ...p } });
  const setInst = (p: Partial<ContractData["instalacion"]>) => onChange({ ...data, instalacion: { ...data.instalacion, ...p } });
  const setSistema = (p: Partial<ContractData["sistema"]>) => onChange({ ...data, sistema: { ...data.sistema, ...p } });
  const setComercial = (p: Partial<ContractData["comercial"]>) => onChange({ ...data, comercial: { ...data.comercial, ...p } });
  const setContrato = (p: Partial<ContractData["contrato"]>) => onChange({ ...data, contrato: { ...data.contrato, ...p } });

  return (
    <div className="space-y-8">
      {/* 1 · Cliente */}
      <section id="seccion-cliente" className="scroll-mt-28">
        <h2 className={H2}>Cliente</h2>
        <div className={GRID}>
          <TextField label="Nombre / Razón social" value={data.cliente.nombre} onChange={(v) => setCliente({ nombre: v })} error={errors["cliente.nombre"]} />
          <TextField label="Documento de identidad" value={data.cliente.documento} onChange={(v) => setCliente({ documento: v })} error={errors["cliente.documento"]} />
        </div>
      </section>

      {/* 2 · Inmueble */}
      <section id="seccion-instalacion" className="scroll-mt-28">
        <h2 className={H2}>Inmueble de la instalación</h2>
        <div className={GRID}>
          <TextField label="Dirección" value={data.instalacion.direccion} onChange={(v) => setInst({ direccion: v })} error={errors["instalacion.direccion"]} />
          <TextField label="Ciudad" value={data.instalacion.ciudad} onChange={(v) => setInst({ ciudad: v })} error={errors["instalacion.ciudad"]} />
          <TextField label="Departamento" value={data.instalacion.departamento} onChange={(v) => setInst({ departamento: v })} error={errors["instalacion.departamento"]} />
        </div>
      </section>

      {/* 3 · Sistema fotovoltaico */}
      <section id="seccion-sistema" className="scroll-mt-28">
        <h2 className={H2}>Sistema fotovoltaico</h2>
        <p className={SUB}>Generación solar</p>
        <div className={GRID}>
          <NumberField label="Cantidad de paneles" value={data.sistema.cantidadPaneles} onChange={(v) => setSistema({ cantidadPaneles: v })} min={1} error={errors["sistema.cantidadPaneles"]} />
          <NumberField label="Potencia por panel (Wp)" value={data.sistema.potenciaUnitariaWp} onChange={(v) => setSistema({ potenciaUnitariaWp: v })} min={1} error={errors["sistema.potenciaUnitariaWp"]} />
          <NumberField label="Potencia total (kWp)" value={data.sistema.potenciaTotalKwp} onChange={(v) => setSistema({ potenciaTotalKwp: v })} min={0} step={0.01} />
          <TextField label="Marca de paneles" value={data.sistema.marcaPaneles} onChange={(v) => setSistema({ marcaPaneles: v })} error={errors["sistema.marcaPaneles"]} />
        </div>
        <p className={SUB}>Inversor</p>
        <div className={GRID}>
          <NumberField label="Cantidad de inversores" value={data.sistema.cantidadInversores} onChange={(v) => setSistema({ cantidadInversores: v })} min={1} error={errors["sistema.cantidadInversores"]} />
          <NumberField label="Potencia inversor (kW)" value={data.sistema.potenciaInversorKw} onChange={(v) => setSistema({ potenciaInversorKw: v })} min={0} step={0.1} />
          <TextField label="Marca de inversor" value={data.sistema.marcaInversor} onChange={(v) => setSistema({ marcaInversor: v })} error={errors["sistema.marcaInversor"]} />
        </div>
        <p className={SUB}>Estructura y energía</p>
        <div className={GRID}>
          <TextField label="Tipo de techo" value={data.sistema.tipoTecho} onChange={(v) => setSistema({ tipoTecho: v })} placeholder="Chapa / teja / hormigón…" error={errors["sistema.tipoTecho"]} />
          <NumberField label="Generación anual estimada (kWh/año)" value={data.sistema.generacionAnualKwh} onChange={(v) => setSistema({ generacionAnualKwh: v })} min={0} />
        </div>
      </section>

      {/* 4 · Comercial + Contrato */}
      <section id="seccion-contrato" className="scroll-mt-28">
        <h2 className={H2}>Precio y datos del contrato</h2>
        <div className={GRID}>
          <NumberField label="Precio total (USD c/IVA)" value={data.comercial.precioTotalUsd} onChange={(v) => setComercial({ precioTotalUsd: v })} min={0} />
          <TextField label="Lugar de firma" value={data.contrato.lugar} onChange={(v) => setContrato({ lugar: v })} error={errors["contrato.lugar"]} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Fecha del contrato</span>
            <input
              type="date"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              value={data.contrato.fecha}
              onChange={(e) => setContrato({ fecha: e.target.value })}
            />
            {errors["contrato.fecha"] ? <span className="mt-1 block text-[11px] text-red-400">{errors["contrato.fecha"]}</span> : null}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Fecha tentativa de inicio de obra (opcional)</span>
            <input
              type="date"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              value={data.contrato.fechaInicioObra}
              onChange={(e) => setContrato({ fechaInicioObra: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-3">
          <TextAreaField label="Observaciones (opcional)" value={data.notas} onChange={(v) => onChange({ ...data, notas: v })} placeholder="Cláusulas particulares, aclaraciones…" />
        </div>
      </section>
    </div>
  );
}
