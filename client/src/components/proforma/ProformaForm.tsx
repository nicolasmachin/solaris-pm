import { NumberField, TextAreaField, TextField } from "../proposals-v2/fields";
import type { ProformaData, ProformaTextos } from "../../types/proforma";

const H2 = "text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]";
const SUB = "mb-1.5 mt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2";

// Grupos de la sección avanzada "Textos del documento". Cada entrada es una clave
// editable de `textos` con su etiqueta en el form.
const TEXTOS_GRUPOS: { titulo: string; campos: { key: keyof ProformaTextos; label: string }[] }[] = [
  {
    titulo: "Título",
    campos: [
      { key: "tituloLinea1", label: "Título línea 1" },
      { key: "tituloLinea2", label: "Título línea 2" },
    ],
  },
  {
    titulo: "Encabezados y rótulos",
    campos: [
      { key: "headingCliente", label: "Encabezado datos del cliente" },
      { key: "labelNombre", label: "Rótulo: nombre" },
      { key: "labelCi", label: "Rótulo: documento" },
      { key: "labelDireccion", label: "Rótulo: dirección" },
      { key: "labelTelefono", label: "Rótulo: teléfono" },
      { key: "labelMail", label: "Rótulo: mail" },
      { key: "labelFecha", label: "Rótulo: fecha" },
    ],
  },
  {
    titulo: "Tabla y descripción",
    campos: [
      { key: "thConcepto", label: "Columna: concepto" },
      { key: "thMonto", label: "Columna: monto solicitado" },
      { key: "thPlazo", label: "Columna: plazo" },
      { key: "thTasa", label: "Columna: tasa" },
      { key: "bannerDescripcion", label: "Banner descripción" },
      { key: "nota", label: "Nota (pie del cuerpo)" },
    ],
  },
  {
    titulo: "Firma",
    campos: [
      { key: "firmante", label: "Firmante" },
      { key: "cargo", label: "Cargo" },
    ],
  },
  {
    titulo: "Pie de página",
    campos: [
      { key: "footerMarca", label: "Marca" },
      { key: "footerRazonSocial", label: "Razón social" },
      { key: "footerRut", label: "RUT" },
      { key: "footerCuentaBbva", label: "Cuenta BBVA" },
      { key: "footerTel", label: "Teléfono" },
      { key: "footerEmail", label: "Email" },
      { key: "footerWeb", label: "Web" },
      { key: "footerDomicilio", label: "Domicilio" },
    ],
  },
];

// Formulario de la proforma (columna izquierda). Todo el texto es editable: los
// valores comunes arriba y todos los rótulos/encabezados/pie en la sección
// avanzada. Secciones con id="seccion-*" para el scroll a faltantes.
export function ProformaForm({
  data,
  onChange,
  errors,
}: {
  data: ProformaData;
  onChange: (next: ProformaData) => void;
  errors: Record<string, string>;
}) {
  const setCliente = (p: Partial<ProformaData["cliente"]>) => onChange({ ...data, cliente: { ...data.cliente, ...p } });
  const setFin = (p: Partial<ProformaData["financiacion"]>) => onChange({ ...data, financiacion: { ...data.financiacion, ...p } });
  const setTexto = (key: keyof ProformaTextos, v: string) => onChange({ ...data, textos: { ...data.textos, [key]: v } });

  return (
    <div className="space-y-8">
      {/* 1 · Cliente */}
      <section id="seccion-cliente" className="scroll-mt-28">
        <h2 className={H2}>Datos del cliente</h2>
        <div className={GRID}>
          <TextField label="Nombre y apellido" value={data.cliente.nombre} onChange={(v) => setCliente({ nombre: v })} error={errors["cliente.nombre"]} />
          <TextField label="CI" value={data.cliente.documento} onChange={(v) => setCliente({ documento: v })} error={errors["cliente.documento"]} />
          <div className="sm:col-span-2">
            <TextField label="Dirección" value={data.cliente.direccion} onChange={(v) => setCliente({ direccion: v })} error={errors["cliente.direccion"]} />
          </div>
          <TextField label="Teléfono" value={data.cliente.telefono} onChange={(v) => setCliente({ telefono: v })} />
          <TextField label="Mail" value={data.cliente.email} onChange={(v) => setCliente({ email: v })} />
        </div>
      </section>

      {/* 2 · Financiación */}
      <section id="seccion-financiacion" className="scroll-mt-28">
        <h2 className={H2}>Financiación (BBVA)</h2>
        <div className={GRID}>
          <TextField label="Concepto" value={data.financiacion.concepto} onChange={(v) => setFin({ concepto: v })} error={errors["financiacion.concepto"]} />
          <NumberField label="Monto solicitado (USD)" value={data.financiacion.montoSolicitadoUsd} onChange={(v) => setFin({ montoSolicitadoUsd: v })} min={0} error={errors["financiacion.montoSolicitadoUsd"]} />
          <NumberField label="Plazo (meses)" value={data.financiacion.plazoMeses} onChange={(v) => setFin({ plazoMeses: v })} min={1} error={errors["financiacion.plazoMeses"]} />
          <NumberField label="Tasa en UI (%)" value={data.financiacion.tasaUi} onChange={(v) => setFin({ tasaUi: v })} min={0} step={0.1} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Fecha</span>
            <input
              type="date"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
              value={data.fecha}
              onChange={(e) => onChange({ ...data, fecha: e.target.value })}
            />
            {errors["fecha"] ? <span className="mt-1 block text-[11px] text-red-400">{errors["fecha"]}</span> : null}
          </label>
        </div>
      </section>

      {/* 3 · Descripción */}
      <section id="seccion-descripcion" className="scroll-mt-28">
        <h2 className={H2}>Descripción del producto</h2>
        <p className={SUB}>Texto libre. Cada línea que empiece con “• ” se muestra como viñeta.</p>
        <TextAreaField label="Descripción" value={data.descripcion} onChange={(v) => onChange({ ...data, descripcion: v })} />
        {errors["descripcion"] ? <span className="mt-1 block text-[11px] text-red-400">{errors["descripcion"]}</span> : null}
      </section>

      {/* 4 · Textos del documento (avanzado) */}
      <section className="scroll-mt-28">
        <details className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
            Textos del documento (avanzado)
          </summary>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Todos los textos fijos del documento (títulos, rótulos, encabezados, firma y pie) — editalos si necesitás.
          </p>
          {TEXTOS_GRUPOS.map((g) => (
            <div key={g.titulo}>
              <p className={SUB}>{g.titulo}</p>
              <div className={GRID}>
                {g.campos.map((f) => (
                  <TextField
                    key={f.key}
                    label={f.label}
                    value={data.textos[f.key]}
                    onChange={(v) => setTexto(f.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </details>
      </section>
    </div>
  );
}
