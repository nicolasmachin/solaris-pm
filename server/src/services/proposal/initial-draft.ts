// Precarga del borrador de propuesta: el `data` inicial de un cotizador recién
// abierto, armado desde los defaults del singleton y lo que ya se sabe del lead.
//
// Vive en el servidor porque hay dos consumidores: el constructor de la app y el
// conector MCP, que arma propuestas por chat. Antes existía solo en el cliente
// (`client/src/lib/proposalDraft.ts`), y esa era la razón por la que no se podía
// cotizar desde el celular.
//
// Lee el JSON crudo del singleton y NO `resolveDefaults()`: ese aplana lo que
// consume la calculadora y descarta justamente lo que hace falta acá (marcas,
// plazos, potencia por panel).

import { ProposalVariante } from "@prisma/client";

import { saludoPara } from "./salutation.js";
import type { DraftDataPublish } from "./schemas/draft.schema.js";

/** Una variable del singleton: `{ value, asesorCanOverride }`. */
function flaggedValue(node: unknown): unknown {
  if (typeof node !== "object" || node === null || !("value" in node)) return undefined;
  return (node as { value: unknown }).value;
}

function numDefault(raw: Record<string, unknown>, key: string, fallback: number): number {
  const v = flaggedValue(raw[key]);
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

/** Variable dentro de un sub-objeto del singleton (`b2b`, `plazos`). */
function numDefaultIn(
  raw: Record<string, unknown>,
  group: string,
  key: string,
  fallback: number,
): number {
  const node = raw[group];
  if (typeof node !== "object" || node === null) return fallback;
  const v = flaggedValue((node as Record<string, unknown>)[key]);
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

function strDefault(raw: Record<string, unknown>, key: string, fallback: string): string {
  const v = flaggedValue(raw[key]);
  return typeof v === "string" ? v : fallback;
}

/**
 * Plazo de entrega por defecto, derivado de los días del singleton
 * (coordinación + instalación). Es sólo la precarga; el asesor lo edita.
 */
function plazoDefault(raw: Record<string, unknown>): string {
  const dias = (k: string) => numDefaultIn(raw, "plazos", k, 0);
  const semanas = Math.max(1, Math.round((dias("diasCoordinacion") + dias("diasInstalacion")) / 7));
  return `${semanas} a ${semanas + 1} semanas`;
}

/**
 * Fecha de hoy en Uruguay, no en UTC.
 *
 * El servidor corre en UTC, así que un `toISOString()` pelado fecha la
 * propuesta al día siguiente desde las 21:00 hora local — y esa fecha se
 * imprime en el PDF que ve el cliente. Cotizar de noche no debería adelantar
 * el documento un día.
 */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Fecha con la que sale el documento.
 *
 * El borrador es uno solo por lead y sobrevive entre versiones, así que su
 * `fecha` quedaba clavada en el día que se armó la V1: una V2 emitida una
 * semana después salía con la fecha vieja impresa en la portada. La fecha de
 * una propuesta es la de su emisión, no la de la primera vez que se abrió el
 * cotizador.
 *
 * Solo se corrige hacia adelante: una fecha de hoy o futura se respeta (se
 * puede fechar una propuesta para mañana a propósito). El formato es
 * YYYY-MM-DD, así que la comparación de strings alcanza.
 */
export function fechaVigente(fecha: string | undefined | null): string {
  const hoy = todayIso();
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return hoy;
  return fecha < hoy ? hoy : fecha;
}

export interface LeadParaPrecarga {
  clientName: string;
  roofType?: string | null;
  notes?: string | null;
}

/**
 * `data` inicial de un borrador nuevo.
 *
 * Los ceros son deliberados: son los campos que el asesor tiene que completar
 * sí o sí (paneles, m² de techo, potencia del inversor, cuánto paga de UTE), y
 * dejarlos en cero hace que el borrador no valide para publicar hasta que se
 * carguen. Ver `draftDataPublishSchema`.
 *
 * ⚠️ Espeja `buildInitialDraftData` del cliente hasta que ese consumidor migre
 * a este endpoint; después queda como única fuente.
 */
export function buildInitialDraftData(
  rawDefaults: unknown,
  lead: LeadParaPrecarga,
  variante: ProposalVariante = ProposalVariante.RESIDENCIAL,
): DraftDataPublish {
  const raw =
    typeof rawDefaults === "object" && rawDefaults !== null
      ? (rawDefaults as Record<string, unknown>)
      : {};
  const esEmpresa = variante === ProposalVariante.EMPRESA;

  return {
    variante,
    cliente: {
      nombre: lead.clientName,
      dirigidoA: saludoPara(lead.clientName),
      ciudad: "",
    },
    // En B2B la razón social arranca con el nombre del lead: casi siempre es
    // eso mismo, y si no, se corrige en el formulario.
    empresa: {
      razonSocial: esEmpresa ? lead.clientName : "",
      rut: "",
      contactoNombre: "",
      contactoCargo: "",
    },
    factura: {
      pagaMensualPesos: 0,
      tarifa: "Simple",
      suministro: "monofásico",
      potenciaContratadaKw: 0,
    },
    techo: { descripcion: lead.roofType ?? "", tamanoM2: 0 },
    cotizacion: {
      distanciaInstalacionKm: numDefault(raw, "distanciaInstalacionKmDefault", 0),
      cotizacionDolar: numDefault(raw, "cotizacionDolarDefault", 40),
      markupPorcentaje: esEmpresa
        ? numDefaultIn(raw, "b2b", "markupPorcentajeDefault", 20)
        : numDefault(raw, "markupPorcentajeDefault", 15),
      plazoEntrega: plazoDefault(raw),
    },
    sistema: {
      cantidadPaneles: 0,
      potenciaPanelW: numDefault(raw, "potenciaPanelWDefault", 0),
      marcaPaneles: strDefault(raw, "marcaPanelesDefault", ""),
      potenciaInversorKw: 0,
      marcaInversor: strDefault(raw, "marcaInversorDefault", ""),
      tipoMontaje: lead.roofType ?? "",
    },
    fecha: todayIso(),
    notas: lead.notes ?? "",
    itemsAdicionales: [],
  };
}

/**
 * Completa un borrador guardado sobre la precarga.
 *
 * Hace falta porque el autosave guarda con el schema lenient: un borrador viejo
 * puede no tener campos que después se agregaron, y quien lo lee necesita el
 * objeto entero. No escribe nada — es el `data` que se devuelve, no el que se
 * persiste.
 */
export function mergeDraftData(
  base: DraftDataPublish,
  stored: unknown,
): DraftDataPublish {
  if (typeof stored !== "object" || stored === null) return base;
  const s = stored as Partial<DraftDataPublish>;

  const cliente = { ...base.cliente, ...s.cliente };
  // El saludo se deriva siempre del nombre, incluso en borradores que lo traen
  // tipeado a mano: es dato calculado, no un campo más del formulario.
  cliente.dirigidoA = saludoPara(cliente.nombre);

  return {
    // La variante la manda la fila, no el contenido guardado: si no, un
    // borrador viejo sin variante volvería residencial al cotizador B2B.
    variante: base.variante,
    cliente,
    // El `!` no es descuido: `base` viene de buildInitialDraftData, que siempre
    // los completa. El Partial es del lado guardado, no de la base.
    empresa: { ...base.empresa!, ...s.empresa },
    factura: { ...base.factura, ...s.factura },
    techo: { ...base.techo, ...s.techo },
    cotizacion: { ...base.cotizacion, ...s.cotizacion },
    sistema: { ...base.sistema, ...s.sistema },
    // Se refresca si quedó en el pasado: ver fechaVigente().
    fecha: fechaVigente(s.fecha ?? base.fecha),
    notas: s.notas ?? base.notas,
    itemsAdicionales: s.itemsAdicionales ?? base.itemsAdicionales,
  };
}
