import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, Eye, FileText, Lock, Trash2, XCircle } from "lucide-react";

import {
  TIPO_LABEL,
  fileSrc,
  type DatosPersonales,
  type DatosSubida,
  type DocumentoLegajo,
  type ResumenLegajo,
  type TipoDocumento,
} from "../../api/rrhh.api";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";

// Piezas compartidas entre Mi legajo (la persona) y el legajo visto por RRHH.

export const inputClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

export const cardClass = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]";

export function errorMsg(e: unknown, fallback: string) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

/** "2026-10-26" → "26/10/2026". */
export function fmtFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

/** "2026-10" → "octubre de 2026". */
export function fmtPeriodo(periodo: string | null | undefined) {
  if (!periodo) return "";
  const [a, m] = periodo.split("-");
  return `${MESES[Number(m) - 1] ?? m} de ${a}`;
}

/** El mes pasado como "AAAA-MM": es el que se liquida al principio del mes. */
export function periodoAnterior() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Campo({ label, children, ayuda }: { label: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="block text-xs text-[var(--color-text-muted)]">
      <span className="mb-1 block">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-[11px]">{ayuda}</span>}
    </label>
  );
}

// ─── Alertas ────────────────────────────────────────────────────────────────

/** Aviso de lo que falta, venció o vence pronto. No muestra nada si está todo en orden. */
export function AlertasResumen({ resumen, propio }: { resumen: ResumenLegajo; propio: boolean }) {
  const filas: Array<{ tono: string; icono: ReactNode; texto: string }> = [];
  if (resumen.vencidos.length)
    filas.push({
      tono: "border-red-500/40 bg-red-500/10 text-red-400",
      icono: <XCircle size={16} />,
      texto: `Vencido: ${resumen.vencidos.map((t) => TIPO_LABEL[t]).join(", ")}.${propio ? " Renovalo y subí el nuevo." : ""}`,
    });
  if (resumen.porVencer.length)
    filas.push({
      tono: "border-amber-500/40 bg-amber-500/10 text-amber-400",
      icono: <Clock size={16} />,
      texto: `Vence en menos de 30 días: ${resumen.porVencer.map((t) => TIPO_LABEL[t]).join(", ")}.`,
    });
  if (resumen.faltantes.length)
    filas.push({
      tono: "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]",
      icono: <AlertTriangle size={16} />,
      texto: `${propio ? "Te falta cargar" : "Falta"}: ${resumen.faltantes.map((t) => TIPO_LABEL[t]).join(", ")}.`,
    });
  if (filas.length === 0) return null;
  return (
    <div className="space-y-2">
      {filas.map((f) => (
        <div key={f.texto} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${f.tono}`}>
          <span className="mt-0.5 flex-shrink-0">{f.icono}</span>
          <span>{f.texto}</span>
        </div>
      ))}
    </div>
  );
}

/** Chips chicos para la tabla de personas. */
export function ChipsAlertas(p: { pendientes?: number; vencidos: number; porVencer: number; faltantes: number }) {
  const chips: Array<[string, string]> = [];
  if (p.pendientes) chips.push([`${p.pendientes} por validar`, "bg-blue-500/15 text-blue-400"]);
  if (p.vencidos) chips.push([`${p.vencidos} vencido${p.vencidos > 1 ? "s" : ""}`, "bg-red-500/15 text-red-400"]);
  if (p.porVencer) chips.push([`${p.porVencer} por vencer`, "bg-amber-500/15 text-amber-400"]);
  if (p.faltantes) chips.push([`${p.faltantes} faltante${p.faltantes > 1 ? "s" : ""}`, "bg-zinc-500/15 text-zinc-300"]);
  if (chips.length === 0) return <span className="text-xs text-green-400">Al día</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map(([t, c]) => (
        <span key={t} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${c}`}>
          {t}
        </span>
      ))}
    </span>
  );
}

// ─── Documentos ─────────────────────────────────────────────────────────────

function EstadoBadge({ doc }: { doc: DocumentoLegajo }) {
  if (doc.estado === "PENDIENTE")
    return <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">Pendiente de validar</span>;
  if (doc.estado === "RECHAZADO")
    return <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">Rechazado</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400">
      <CheckCircle2 size={11} /> Validado
    </span>
  );
}

function VencimientoTexto({ doc }: { doc: DocumentoLegajo }) {
  if (!doc.vencimiento) return null;
  const tono =
    doc.estadoVencimiento === "VENCIDO"
      ? "text-red-400 font-semibold"
      : doc.estadoVencimiento === "POR_VENCER"
        ? "text-amber-400 font-semibold"
        : "text-[var(--color-text-muted)]";
  const prefijo = doc.estadoVencimiento === "VENCIDO" ? "Venció el" : "Vence el";
  return <span className={tono}>{`${prefijo} ${fmtFecha(doc.vencimiento)}`}</span>;
}

/**
 * Una fila de documento. `acciones` agrega botones a la derecha (validar,
 * editar, borrar) además de Ver y Descargar.
 */
export function DocumentoFila({
  doc,
  acciones,
  mostrarNuevo,
}: {
  doc: DocumentoLegajo;
  acciones?: ReactNode;
  mostrarNuevo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-border)] py-3 last:border-b-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <FileText size={18} className="mt-0.5 flex-shrink-0 text-[var(--color-text-muted)]" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <span className="truncate">{doc.titulo}</span>
            {mostrarNuevo && !doc.vistoAt && (
              <span className="rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-900">
                nuevo
              </span>
            )}
            {doc.soloInterno && (
              <span className="inline-flex items-center gap-1 rounded bg-zinc-500/15 px-1.5 py-0.5 text-[10px] text-zinc-300">
                <Lock size={10} /> Solo administración
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
            <span>{doc.tipoLabel}</span>
            {doc.periodo && <span>{fmtPeriodo(doc.periodo)}</span>}
            <VencimientoTexto doc={doc} />
            <EstadoBadge doc={doc} />
            <span>Cargado el {fmtFecha(doc.createdAt)} por {doc.subidoPor}</span>
          </p>
          {doc.estado === "RECHAZADO" && doc.motivoRechazo && (
            <p className="mt-1 text-xs text-red-400">Motivo: {doc.motivoRechazo}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-8 sm:pl-0">
        <a
          href={fileSrc(doc.previewUrl)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
        >
          <Eye size={12} /> Ver
        </a>
        <a
          href={fileSrc(doc.downloadUrl)}
          className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
        >
          <Download size={12} /> Descargar
        </a>
        {acciones}
      </div>
    </div>
  );
}

export function BotonBorrar({ onClick, disabled, title }: { onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? "Quitar"}
      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 size={12} />
    </button>
  );
}

/**
 * Modal para subir un documento. `gestion` suma lo que solo carga RRHH:
 * título, período (recibos) y "Solo administración".
 */
export function SubirDocumentoSheet({
  open,
  onClose,
  tipos,
  gestion = false,
  enviando,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  tipos: Array<{ tipo: TipoDocumento; label: string }>;
  gestion?: boolean;
  enviando: boolean;
  onSubmit: (file: File, datos: DatosSubida) => void;
}) {
  const [tipo, setTipo] = useState<TipoDocumento | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [vencimiento, setVencimiento] = useState("");
  const [titulo, setTitulo] = useState("");
  const [periodo, setPeriodo] = useState(periodoAnterior());
  const [soloInterno, setSoloInterno] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipo("");
    setFile(null);
    setVencimiento("");
    setTitulo("");
    setPeriodo(periodoAnterior());
    setSoloInterno(false);
  }, [open]);

  const esRecibo = tipo === "RECIBO_SUELDO";
  const listo = Boolean(tipo && file && (!esRecibo || periodo));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cargar documento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!listo || enviando}
            onClick={() =>
              file &&
              tipo &&
              onSubmit(file, {
                tipo,
                vencimiento: vencimiento || undefined,
                titulo: gestion ? titulo : undefined,
                periodo: esRecibo ? periodo : undefined,
                soloInterno: gestion ? soloInterno : undefined,
              })
            }
          >
            {enviando ? "Subiendo…" : "Subir"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Campo label="¿Qué documento es?">
          <select className={inputClass} value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)}>
            <option value="">Elegí uno…</option>
            {tipos.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Archivo" ayuda="Una foto clara o un PDF. Desde el celular podés sacarle la foto directamente.">
          <input
            type="file"
            accept="image/*,application/pdf,.heic,.heif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--color-text-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-border)] file:px-3 file:py-2 file:text-sm file:text-[var(--color-text-primary)]"
          />
        </Campo>
        {esRecibo && gestion && (
          <Campo label="Mes que liquida">
            <input type="month" className={inputClass} value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </Campo>
        )}
        {!esRecibo && (
          <Campo
            label="Vencimiento (si tiene)"
            ayuda={gestion ? "Se avisa a la persona y a administración 30 días antes." : "Si el documento vence, poné la fecha: te avisamos 30 días antes."}
          >
            <input type="date" className={inputClass} value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
          </Campo>
        )}
        {gestion && (
          <>
            <Campo label="Título (opcional)" ayuda="Si lo dejás vacío se usa el tipo de documento.">
              <input className={inputClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} />
            </Campo>
            <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={soloInterno}
                onChange={(e) => setSoloInterno(e.target.checked)}
              />
              <span>
                Solo administración
                <span className="block text-[11px] text-[var(--color-text-muted)]">La persona no lo ve en su legajo.</span>
              </span>
            </label>
          </>
        )}
        {!gestion && (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Queda pendiente hasta que administración lo revise. Si hay algo mal, te avisamos qué volver a subir.
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ─── Datos personales ───────────────────────────────────────────────────────

type CampoDef = { key: keyof DatosPersonales; label: string; type?: string; placeholder?: string };

export const GRUPOS_PERSONALES: Array<{ id: string; titulo: string; nota?: string; campos: CampoDef[] }> = [
  {
    id: "identificacion",
    titulo: "Identificación",
    campos: [
      { key: "cedula", label: "Cédula", placeholder: "1.234.567-8" },
      { key: "fechaNacimiento", label: "Fecha de nacimiento", type: "date" },
    ],
  },
  {
    id: "contacto",
    titulo: "Contacto",
    campos: [
      { key: "direccion", label: "Dirección" },
      { key: "telefonoPersonal", label: "Teléfono personal", type: "tel" },
      { key: "emailPersonal", label: "Mail personal", type: "email" },
    ],
  },
  {
    id: "emergencia",
    titulo: "En caso de emergencia",
    campos: [
      { key: "emergenciaNombre", label: "A quién avisar" },
      { key: "emergenciaTelefono", label: "Su teléfono", type: "tel" },
      { key: "emergenciaVinculo", label: "Qué es tuyo", placeholder: "Madre, pareja…" },
    ],
  },
  {
    id: "salud",
    titulo: "Salud",
    nota: "Opcional. Solo lo ve administración, y sirve si te pasa algo en una obra.",
    campos: [
      { key: "mutualista", label: "Mutualista" },
      { key: "emergenciaMovil", label: "Emergencia móvil" },
      { key: "grupoSanguineo", label: "Grupo sanguíneo", placeholder: "0+" },
      { key: "alergias", label: "Alergias o condiciones a tener en cuenta" },
    ],
  },
  {
    id: "cobro",
    titulo: "Cobro del sueldo",
    campos: [
      { key: "banco", label: "Banco" },
      { key: "cuentaBancaria", label: "Número de cuenta" },
    ],
  },
  {
    id: "talles",
    titulo: "Talles de ropa y calzado",
    nota: "Para la ropa de trabajo y los equipos de protección.",
    campos: [
      { key: "talleRopa", label: "Talle de ropa", placeholder: "M, L, XL…" },
      { key: "talleCalzado", label: "Número de calzado", placeholder: "42" },
    ],
  },
  {
    id: "licencia",
    titulo: "Licencia de conducir",
    nota: "La foto y el vencimiento se cargan en documentos.",
    campos: [{ key: "licenciaConducirCategoria", label: "Categoría", placeholder: "A, B, G1…" }],
  },
];

/** Formulario agrupado de datos personales. Devuelve solo lo que cambió. */
export function DatosPersonalesForm({
  inicial,
  ocultar = [],
  guardando,
  onGuardar,
}: {
  inicial: DatosPersonales;
  ocultar?: string[];
  guardando: boolean;
  onGuardar: (cambios: Partial<DatosPersonales>) => void;
}) {
  const [valores, setValores] = useState<DatosPersonales>(inicial);
  useEffect(() => setValores(inicial), [inicial]);

  const cambios = Object.fromEntries(
    (Object.keys(valores) as Array<keyof DatosPersonales>)
      .filter((k) => (valores[k] ?? "") !== (inicial[k] ?? ""))
      .map((k) => [k, valores[k] || null]),
  ) as Partial<DatosPersonales>;
  const hayCambios = Object.keys(cambios).length > 0;

  return (
    <div className="space-y-5">
      {GRUPOS_PERSONALES.filter((g) => !ocultar.includes(g.id)).map((g) => (
        <fieldset key={g.id}>
          <legend className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">{g.titulo}</legend>
          {g.nota && <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">{g.nota}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {g.campos.map((c) => (
              <Campo key={c.key} label={c.label}>
                <input
                  type={c.type ?? "text"}
                  className={inputClass}
                  placeholder={c.placeholder}
                  value={valores[c.key] ?? ""}
                  onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                />
              </Campo>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex justify-end">
        <Button disabled={!hayCambios || guardando} onClick={() => onGuardar(cambios)}>
          {guardando ? "Guardando…" : "Guardar datos"}
        </Button>
      </div>
    </div>
  );
}

export function datosPersonalesDe(l: DatosPersonales): DatosPersonales {
  const out = {} as DatosPersonales;
  for (const g of GRUPOS_PERSONALES) for (const c of g.campos) out[c.key] = l[c.key] ?? null;
  return out;
}
