// Comprobantes que Voltia le emite a sus clientes por Biller: la factura del
// proyecto (e-Factura 111 a un RUT, e-Ticket 101 a una persona) y sus notas de
// crédito (112 / 102).
//
// Regla de negocio (decidida 30-sep-2026): NADA se emite sin que una persona
// confirme el borrador exacto. Por eso este servicio separa:
//   - armarBorradorFactura / armarBorradorNotaCredito: arman lo que se mandaría,
//     sin tocar Biller.
//   - emitirCfe: recibe el borrador confirmado y lo emite. No lo llama ningún job.
//
// Contra la doble emisión (Biller no tiene idempotency key): la fila se crea en
// EMITIENDO con un `numero_interno` propio y único ANTES de llamar a Biller.
//   - 201 → ESPERANDO_DGI con el id de Biller.
//   - 422 "Número interno no puede estar repetido" → ya estaba emitido: se adopta.
//   - otro 4xx → ERROR, no se emitió nada; se puede volver a intentar.
//   - corte de red / 5xx / timeout → se busca por numero_interno; si no aparece
//     queda DUDOSO y el job lo vuelve a buscar. No se deja reintentar mientras
//     haya uno DUDOSO en el proyecto.
// Todo pasa por una cola de un solo pedido a la vez (Biller admite 1 por segundo
// al emitir).

import { AuditAction, AuditEntityType, EstadoCfeEmitido, FileAttachmentTipo, Moneda, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { saveBufferAsAttachment } from "../file-storage.service.js";
import { esCiUruguayaValida } from "../ute-extract/index.js";
import { AppError, badRequest, conflict, notFound } from "../../utils/errors.js";
import { parseDateOnly, toDateOnlyString } from "../../utils/dates.js";
import { hoyUruguay } from "../../utils/uruguay.js";
import { bajarPdfBiller, billerConfigurado, buscarRazonSocial } from "./recibidos.service.js";

const BASE_URL = process.env.BILLER_URL ?? "https://test.biller.uy";

/** El FileAttachment de la factura del cliente (mismo que el adjunto a mano). */
export const FACTURA_CLIENTE_SOURCE = "factura-cliente";
const NOTA_CREDITO_SOURCE = "nota-credito-cliente";

export const TIPO_FACTURA_RUT = 111;
export const TIPO_FACTURA_CI = 101;
const TIPO_NC: Record<number, number> = { 111: 112, 101: 102 };

export const ETIQUETA_TIPO: Record<number, string> = {
  101: "e-Ticket", 102: "Nota de crédito de e-Ticket",
  111: "e-Factura", 112: "Nota de crédito de e-Factura",
};

/** Estados en los que un CFE cuenta como emitido (o puede estarlo). */
const ESTADOS_VIVOS: EstadoCfeEmitido[] = [
  EstadoCfeEmitido.EMITIENDO,
  EstadoCfeEmitido.DUDOSO,
  EstadoCfeEmitido.ESPERANDO_DGI,
  EstadoCfeEmitido.ACEPTADO,
];

// ── Configuración ────────────────────────────────────────────────────────────

function esBillerProductivo() {
  return !BASE_URL.includes("test.biller.uy");
}

/**
 * Se puede emitir si hay token y sucursal. Además, contra el Biller productivo
 * solo emite el servidor de producción: un desarrollo con el token real por
 * error no tiene que poder mandar una factura a DGI.
 */
export function estadoEmision(): { habilitada: boolean; ambiente: "TEST" | "PRODUCCION"; motivo: string | null } {
  const ambiente = esBillerProductivo() ? "PRODUCCION" : "TEST";
  if (!billerConfigurado()) return { habilitada: false, ambiente, motivo: "Falta el token de Biller" };
  if (!process.env.BILLER_SUCURSAL) return { habilitada: false, ambiente, motivo: "Falta la sucursal de Biller" };
  if (ambiente === "PRODUCCION" && process.env.NODE_ENV !== "production") {
    return { habilitada: false, ambiente, motivo: "Biller productivo solo emite desde el servidor de producción" };
  }
  return { habilitada: true, ambiente, motivo: null };
}

function exigirEmisionHabilitada() {
  const e = estadoEmision();
  if (!e.habilitada) throw new AppError(409, "BILLER_NO_HABILITADO", e.motivo ?? "Biller no está configurado");
}

// ── Cliente HTTP ─────────────────────────────────────────────────────────────

type RespuestaBiller = { status: number; body: unknown; texto: string };

async function billerFetch(method: "GET" | "POST", path: string, body?: unknown): Promise<RespuestaBiller> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.BILLER_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const texto = await res.text();
  let parsed: unknown = null;
  try { parsed = texto.trim() ? JSON.parse(texto) : null; } catch { parsed = texto; }
  return { status: res.status, body: parsed, texto };
}

// Cola: un pedido de emisión o consulta a la vez, con 1,1 s entre uno y otro.
let cola: Promise<unknown> = Promise.resolve();
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const run = cola.then(fn, fn);
  cola = run.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, 1100)));
  return run;
}

type Obj = Record<string, unknown>;

/** Mensaje legible de un error de Biller (422 trae `errors` por campo). */
function mensajeBiller(r: RespuestaBiller): string {
  const b = r.body as Obj | null;
  if (b && typeof b === "object") {
    const partes: string[] = [];
    if (typeof b.message === "string") partes.push(b.message);
    if (typeof b.error === "string") partes.push(b.error);
    if (b.errors && typeof b.errors === "object") {
      for (const v of Object.values(b.errors as Obj)) {
        if (Array.isArray(v)) partes.push(...v.map(String));
        else partes.push(String(v));
      }
    }
    if (partes.length) return partes.join(" · ");
  }
  return `HTTP ${r.status}: ${r.texto.slice(0, 300)}`;
}

async function buscarPorNumeroInterno(numeroInterno: string, desde: Date): Promise<Obj | null> {
  const d = new Date(desde.getTime() - 86_400_000); // un día de margen por zona horaria
  const desdeStr = `${toDateOnlyString(d)} 00:00:00`;
  const r = await billerFetch(
    "GET",
    `/v2/comprobantes/obtener?numero_interno=${encodeURIComponent(numeroInterno)}&desde=${encodeURIComponent(desdeStr)}`,
  );
  if (r.status !== 200) throw new Error(mensajeBiller(r));
  const lista = Array.isArray(r.body) ? (r.body as Obj[]) : [];
  return lista.find((c) => c.numero_interno === numeroInterno) ?? null;
}

// ── Borrador ─────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  concepto: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(500).optional().nullable(),
  cantidad: z.number().positive(),
  // Precio unitario CON IVA (montos brutos).
  precio: z.number().positive(),
  // 3 = tasa básica (22 %). Se deja elegir por si alguna vez hay un ítem exento.
  indicadorFacturacion: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
});

export const borradorSchema = z.object({
  tipoCfe: z.union([z.literal(101), z.literal(111), z.literal(102), z.literal(112)]),
  formaPago: z.union([z.literal(1), z.literal(2)]),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  moneda: z.nativeEnum(Moneda),
  cliente: z.object({
    tipoDocumento: z.union([z.literal(2), z.literal(3)]), // 2 RUT, 3 CI
    documento: z.string().trim().min(1),
    nombre: z.string().trim().min(1),
    direccion: z.string().trim().min(1).max(70),
    ciudad: z.string().trim().min(1).max(30),
    departamento: z.string().trim().min(1).max(30),
  }),
  items: z.array(itemSchema).min(1).max(20),
  adenda: z.string().trim().max(1000).optional().nullable(),
  // Si viene, Biller le manda el PDF a ese mail. Vacío = no se manda nada.
  emailCliente: z.string().trim().email().optional().nullable(),
  motivo: z.string().trim().max(500).optional().nullable(),
});
export type BorradorCfe = z.infer<typeof borradorSchema>;

const soloDigitos = (s: string) => s.replace(/\D/g, "");
const redondear = (n: number) => Math.round(n * 100) / 100;

export function totalBorrador(b: Pick<BorradorCfe, "items">) {
  return redondear(b.items.reduce((acc, i) => acc + i.cantidad * i.precio, 0));
}

/** Problemas que impiden emitir. Lista vacía = se puede. */
export function validarBorrador(b: BorradorCfe): string[] {
  const p: string[] = [];
  const doc = soloDigitos(b.cliente.documento);
  const esFacturaRut = b.tipoCfe === 111 || b.tipoCfe === 112;
  if (esFacturaRut && b.cliente.tipoDocumento !== 2) p.push("Una e-Factura va a un RUT");
  if (!esFacturaRut && b.cliente.tipoDocumento !== 3) p.push("Un e-Ticket va a una cédula");
  if (b.cliente.tipoDocumento === 2 && doc.length !== 12) p.push("El RUT tiene que tener 12 dígitos");
  if (b.cliente.tipoDocumento === 3 && !esCiUruguayaValida(doc)) p.push("La cédula no es válida (revisar el dígito verificador)");
  if (b.formaPago === 2 && !b.fechaVencimiento) p.push("Una factura a crédito lleva fecha de vencimiento");
  if (b.fechaVencimiento && b.fechaVencimiento < b.fechaEmision) p.push("El vencimiento es anterior a la emisión");
  const hoy = hoyUruguay().iso;
  const max = toDateOnlyString(new Date(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) + 1, Number(hoy.slice(8, 10)))));
  if (b.fechaEmision > (max ?? hoy)) p.push("La fecha de emisión no puede pasar de dos meses a futuro");
  if (b.fechaEmision < "2011-10-01") p.push("Fecha de emisión inválida");
  if (totalBorrador(b) <= 0) p.push("El total tiene que ser mayor a cero");
  return p;
}

const recortar = (s: string, n: number) => (s.length > n ? s.slice(0, n).trim() : s);
const ddmmaaaa = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** El cuerpo exacto que se manda a POST /v3/comprobantes/emitir. */
export function cuerpoBiller(b: BorradorCfe, numeroInterno: string, referenciaBillerId: string | null) {
  const doc = soloDigitos(b.cliente.documento);
  const cliente: Obj = {
    tipo_documento: b.cliente.tipoDocumento,
    documento: doc,
    pais: "UY",
    sucursal: {
      direccion: recortar(b.cliente.direccion, 70),
      ciudad: recortar(b.cliente.ciudad, 30),
      departamento: recortar(b.cliente.departamento, 30),
      pais: "UY",
    },
  };
  // RUT → razon_social (70); CI → nombre_fantasia (30, Biller lo corta ahí).
  if (b.cliente.tipoDocumento === 2) cliente.razon_social = recortar(b.cliente.nombre, 70);
  else cliente.nombre_fantasia = recortar(b.cliente.nombre, 30);

  const cuerpo: Obj = {
    tipo_comprobante: b.tipoCfe,
    numero_interno: numeroInterno,
    forma_pago: b.formaPago,
    fecha_emision: ddmmaaaa(b.fechaEmision),
    sucursal: Number(process.env.BILLER_SUCURSAL),
    moneda: b.moneda,
    // Los precios del borrador ya incluyen IVA: Biller separa neto e IVA.
    montos_brutos: 1,
    cliente,
    items: b.items.map((i) => ({
      cantidad: i.cantidad,
      concepto: i.concepto,
      ...(i.descripcion ? { descripcion: i.descripcion } : {}),
      precio: i.precio,
      indicador_facturacion: i.indicadorFacturacion,
    })),
  };
  if (b.fechaVencimiento && b.formaPago === 2) cuerpo.fecha_vencimiento = ddmmaaaa(b.fechaVencimiento);
  if (b.adenda) cuerpo.adenda = b.adenda;
  // En test nunca se manda mail: la base de desarrollo tiene mails de clientes reales.
  if (b.emailCliente && esBillerProductivo()) cuerpo.emails_notificacion = [b.emailCliente];
  if (referenciaBillerId) cuerpo.referencias = [Number(referenciaBillerId)];
  return cuerpo;
}

/** Factura "viva" del proyecto (emitida, en curso o dudosa), si hay. */
async function facturaVivaDelProyecto(projectId: string) {
  return prisma.cfeEmitido.findFirst({
    where: { projectId, referenciaId: null, estado: { in: ESTADOS_VIVOS } },
    include: { notasCredito: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Total ya acreditado sobre una factura (NC vivas). */
function totalAcreditado(f: { notasCredito: Array<{ estado: EstadoCfeEmitido; total: Prisma.Decimal }> }) {
  return redondear(
    f.notasCredito.filter((n) => ESTADOS_VIVOS.includes(n.estado)).reduce((a, n) => a + Number(n.total), 0),
  );
}

/** Una factura anulada del todo por notas de crédito ya no cuenta: se puede facturar de nuevo. */
async function facturaVigente(projectId: string) {
  const f = await facturaVivaDelProyecto(projectId);
  if (!f) return null;
  if (totalAcreditado(f) >= Number(f.total) - 0.005) return null;
  return f;
}

/**
 * Lo que se mandaría a Biller, armado con los datos del proyecto. Todo es
 * editable en la pantalla antes de confirmar.
 */
export async function armarBorradorFactura(projectId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!p) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const doc = soloDigitos(p.ciCliente ?? "");
  // RUT (12 dígitos) o empresa → e-Factura; si no, e-Ticket con cédula.
  const esRut = doc.length === 12 || (p.empresa && doc.length !== 7 && doc.length !== 8);
  const direccion = [p.calle, p.numCalle].filter((x) => x && x.trim()).join(" ").trim() || (p.clientAddress ?? "");
  const kwp = Number(p.capacityKwp);
  const kwpTxt = Number.isFinite(kwp) && kwp > 0 ? ` de ${kwp.toLocaleString("es-UY", { maximumFractionDigits: 2 })} kWp` : "";

  const borrador: BorradorCfe = {
    tipoCfe: esRut ? TIPO_FACTURA_RUT : TIPO_FACTURA_CI,
    // Contado por defecto: los cobros todavía no emiten recibo (pendiente con el contador).
    formaPago: 1,
    fechaEmision: hoyUruguay().iso,
    fechaVencimiento: null,
    moneda: Moneda.USD,
    cliente: {
      tipoDocumento: esRut ? 2 : 3,
      documento: doc,
      nombre: (p.nombreCliente || p.clientName || "").trim(),
      direccion: recortar(direccion, 70),
      ciudad: recortar(p.locationCity ?? "", 30),
      departamento: recortar(p.locationProvince ?? "", 30),
    },
    items: [{
      concepto: recortar(`Suministro e instalación de sistema solar fotovoltaico${kwpTxt}`, 80),
      descripcion: null,
      cantidad: 1,
      precio: p.budgetUsd != null ? Number(p.budgetUsd) : 0,
      indicadorFacturacion: 3,
    }],
    adenda: `Proyecto ${p.code}`,
    emailCliente: p.clientEmail?.trim() || null,
    motivo: null,
  };

  // Para un RUT, la razón social registrada en DGI manda sobre lo cargado.
  let razonSocialDgi: string | null = null;
  if (esRut && doc.length === 12) razonSocialDgi = await buscarRazonSocial(doc);

  return {
    borrador,
    razonSocialDgi,
    proyecto: { id: p.id, code: p.code, clientName: p.clientName, budgetUsd: p.budgetUsd != null ? Number(p.budgetUsd) : null },
    nota: p.facturaNota,
    facturaVigente: (await facturaVigente(p.id)) != null,
    emision: estadoEmision(),
  };
}

/** Borrador de nota de crédito: total (copia los ítems) o parcial (un renglón por el monto). */
export async function armarBorradorNotaCredito(cfeId: string, opciones: { monto?: number | null }) {
  const f = await prisma.cfeEmitido.findUnique({ where: { id: cfeId }, include: { notasCredito: true } });
  if (!f || f.referenciaId) throw notFound("CFE_NOT_FOUND", "Factura no encontrada");
  const original = (f.payload as unknown as { borrador: BorradorCfe }).borrador;
  const disponible = redondear(Number(f.total) - totalAcreditado(f));

  const total = opciones.monto == null;
  const borrador: BorradorCfe = {
    ...original,
    tipoCfe: TIPO_NC[f.tipoCfe] as BorradorCfe["tipoCfe"],
    formaPago: original.formaPago,
    fechaEmision: hoyUruguay().iso,
    fechaVencimiento: null,
    items: total && disponible >= Number(f.total) - 0.005
      ? original.items
      : [{
          concepto: "Nota de crédito",
          descripcion: null,
          cantidad: 1,
          precio: total ? disponible : redondear(opciones.monto!),
          indicadorFacturacion: 3,
        }],
    adenda: `Corrige ${ETIQUETA_TIPO[f.tipoCfe]} ${f.serie}-${f.numero}`,
    motivo: null,
  };
  return { borrador, disponible, factura: serializarCfe(f), emision: estadoEmision() };
}

// ── Emisión ──────────────────────────────────────────────────────────────────

export async function emitirCfe(input: {
  projectId: string;
  borrador: BorradorCfe;
  referenciaId?: string | null;
  userId: string;
}) {
  exigirEmisionHabilitada();
  const b = input.borrador;
  const problemas = validarBorrador(b);
  if (problemas.length) throw badRequest("BORRADOR_INVALIDO", problemas.join(". "));

  const esNC = b.tipoCfe === 102 || b.tipoCfe === 112;
  if (esNC && !b.motivo) throw badRequest("MOTIVO_REQUERIDO", "La nota de crédito lleva el motivo");
  const project = await prisma.project.findFirst({ where: { id: input.projectId, deletedAt: null } });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

  const dudoso = await prisma.cfeEmitido.findFirst({
    where: { projectId: project.id, estado: { in: [EstadoCfeEmitido.EMITIENDO, EstadoCfeEmitido.DUDOSO] } },
  });
  if (dudoso) {
    throw conflict("CFE_EN_CURSO", "Hay un comprobante de este proyecto que todavía no se sabe si se emitió. Esperá a que se confirme.");
  }

  let referencia: Awaited<ReturnType<typeof facturaVivaDelProyecto>> = null;
  if (esNC) {
    if (!input.referenciaId) throw badRequest("REFERENCIA_REQUERIDA", "Una nota de crédito va contra una factura");
    referencia = await prisma.cfeEmitido.findFirst({
      where: { id: input.referenciaId, projectId: project.id, referenciaId: null },
      include: { notasCredito: true },
    });
    if (!referencia || !referencia.billerId) throw notFound("CFE_NOT_FOUND", "Factura no encontrada");
    if (referencia.estado !== EstadoCfeEmitido.ACEPTADO && referencia.estado !== EstadoCfeEmitido.ESPERANDO_DGI) {
      throw conflict("FACTURA_NO_EMITIDA", "La factura no está emitida");
    }
    if (TIPO_NC[referencia.tipoCfe] !== b.tipoCfe) throw badRequest("TIPO_NC", "El tipo de nota no corresponde a la factura");
    const disponible = Number(referencia.total) - totalAcreditado(referencia);
    if (totalBorrador(b) > disponible + 0.005) {
      throw badRequest("NC_SUPERA", `La nota de crédito supera lo que queda de la factura (USD ${disponible.toFixed(2)})`);
    }
  } else if (await facturaVigente(project.id)) {
    throw conflict("FACTURA_YA_EMITIDA", "Este proyecto ya tiene una factura emitida. Para corregirla, hacé una nota de crédito.");
  }

  const total = totalBorrador(b);
  const fila = await prisma.cfeEmitido.create({
    data: {
      projectId: project.id,
      tipoCfe: b.tipoCfe,
      // Provisorio hasta tener el id de la fila; se fija abajo antes de llamar.
      numeroInterno: `tmp-${Date.now()}-${Math.random()}`,
      fechaEmision: parseDateOnly(b.fechaEmision),
      moneda: b.moneda,
      total,
      clienteNombre: b.cliente.nombre,
      clienteDocumento: soloDigitos(b.cliente.documento),
      referenciaId: referencia?.id ?? null,
      motivo: b.motivo ?? null,
      payload: b as unknown as Prisma.InputJsonValue,
      emitidoPorId: input.userId,
    },
  });
  // Código del proyecto + id de la fila: único aunque se reinicie la base de
  // desarrollo contra la misma cuenta de test de Biller.
  const numeroInterno = `${project.code}-${fila.id}`;
  const cuerpo = cuerpoBiller(b, numeroInterno, referencia?.billerId ?? null);
  await prisma.cfeEmitido.update({
    where: { id: fila.id },
    data: { numeroInterno, payload: { borrador: b, cuerpo } as unknown as Prisma.InputJsonValue },
  });

  const resultado = await enCola(() => llamarEmitir(fila.id, numeroInterno, cuerpo));

  const final = await prisma.cfeEmitido.findUniqueOrThrow({ where: { id: fila.id } });
  if (final.estado === EstadoCfeEmitido.ESPERANDO_DGI || final.estado === EstadoCfeEmitido.ACEPTADO) {
    await alEmitirse(final.id, input.userId);
  }
  if (resultado === "ERROR") throw new AppError(422, "BILLER_RECHAZO", final.error ?? "Biller no emitió el comprobante");
  return serializarCfe(final);
}

type ResultadoLlamado = "EMITIDO" | "ERROR" | "DUDOSO";

async function llamarEmitir(id: string, numeroInterno: string, cuerpo: Obj): Promise<ResultadoLlamado> {
  let r: RespuestaBiller;
  try {
    r = await billerFetch("POST", "/v3/comprobantes/emitir", cuerpo);
  } catch (err) {
    return resolverDudoso(id, numeroInterno, `Sin respuesta de Biller: ${(err as Error).message}`);
  }

  if (r.status === 200 || r.status === 201) {
    const b = r.body as Obj;
    await prisma.cfeEmitido.update({
      where: { id },
      data: {
        estado: EstadoCfeEmitido.ESPERANDO_DGI,
        billerId: String(b.id),
        serie: typeof b.serie === "string" ? b.serie : null,
        numero: b.numero != null ? Number(b.numero) : null,
        hash: typeof b.hash === "string" ? b.hash : null,
        respuesta: b as Prisma.InputJsonValue,
        error: null,
      },
    });
    return "EMITIDO";
  }

  const msg = mensajeBiller(r);
  if (r.status === 422 && /n[uú]mero interno.*repetido/i.test(msg)) {
    // Ya estaba emitido con este número: se adopta.
    return resolverDudoso(id, numeroInterno, msg);
  }
  if (r.status >= 400 && r.status < 500 && r.status !== 429) {
    await prisma.cfeEmitido.update({
      where: { id },
      data: { estado: EstadoCfeEmitido.ERROR, error: msg, respuesta: (r.body ?? null) as Prisma.InputJsonValue },
    });
    return "ERROR";
  }
  return resolverDudoso(id, numeroInterno, msg);
}

/** Busca en Biller por numero_interno: si está, lo adopta; si no, queda DUDOSO. */
async function resolverDudoso(id: string, numeroInterno: string, motivo: string): Promise<ResultadoLlamado> {
  const fila = await prisma.cfeEmitido.findUniqueOrThrow({ where: { id } });
  try {
    const encontrado = await buscarPorNumeroInterno(numeroInterno, fila.createdAt);
    if (encontrado) {
      await prisma.cfeEmitido.update({
        where: { id },
        data: {
          estado: EstadoCfeEmitido.ESPERANDO_DGI,
          billerId: String(encontrado.id),
          serie: typeof encontrado.serie === "string" ? encontrado.serie : null,
          numero: encontrado.numero != null ? Number(encontrado.numero) : null,
          estadoDgi: typeof encontrado.estado === "string" ? encontrado.estado : null,
          respuesta: encontrado as Prisma.InputJsonValue,
          error: null,
        },
      });
      return "EMITIDO";
    }
  } catch (err) {
    motivo = `${motivo} · al buscarlo: ${(err as Error).message}`;
  }
  // Recién creado y no aparece: puede ser un corte antes de llegar. Queda dudoso;
  // el job lo vuelve a buscar y, pasado un rato sin aparecer, lo da por no emitido.
  await prisma.cfeEmitido.update({ where: { id }, data: { estado: EstadoCfeEmitido.DUDOSO, error: motivo } });
  return "DUDOSO";
}

/** Efectos en el proyecto cuando un CFE quedó emitido. */
async function alEmitirse(cfeId: string, userId: string | null) {
  const c = await prisma.cfeEmitido.findUniqueOrThrow({ where: { id: cfeId }, include: { project: true } });
  const etiqueta = `${ETIQUETA_TIPO[c.tipoCfe]} ${c.serie}-${c.numero}`;
  const esNC = c.referenciaId != null;

  if (!esNC) {
    await prisma.project.update({
      where: { id: c.projectId },
      data: { facturaEmitida: true, facturaEmitidaEn: c.project.facturaEmitidaEn ?? new Date() },
    });
  } else if (!(await facturaVigente(c.projectId))) {
    // La NC anuló la factura entera: el proyecto vuelve a "pendiente de facturar".
    await prisma.project.update({ where: { id: c.projectId }, data: { facturaEmitida: false, facturaEmitidaEn: null } });
  }

  if (userId) {
    await createAuditEntry({
      entityType: AuditEntityType.cfe_emitido,
      entityId: c.id,
      projectId: c.projectId,
      userId,
      action: AuditAction.created,
      description: `Emitió ${etiqueta} por ${c.moneda} ${Number(c.total).toFixed(2)} a ${c.clienteNombre}${c.motivo ? ` (${c.motivo})` : ""}`,
    });
  }
}

// ── Seguimiento (job) ────────────────────────────────────────────────────────

const MINUTOS_PARA_DAR_POR_NO_EMITIDO = 30;

/**
 * Consulta el estado ante DGI de lo que está esperando y vuelve a buscar los
 * dudosos. No emite nada: solo lee.
 */
export async function seguirCfesPendientes() {
  if (!billerConfigurado()) return { consultados: 0 };
  const pendientes = await prisma.cfeEmitido.findMany({
    where: {
      OR: [
        { estado: EstadoCfeEmitido.DUDOSO },
        // Un estado que no cambia en un mes no se sigue consultando solo
        // (se puede consultar a mano desde la pantalla).
        { estado: EstadoCfeEmitido.ESPERANDO_DGI, createdAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
        // Un EMITIENDO viejo es un pedido que se cortó a la mitad (reinicio del
        // servidor, por ejemplo): se trata como dudoso.
        { estado: EstadoCfeEmitido.EMITIENDO, createdAt: { lt: new Date(Date.now() - 5 * 60_000) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  for (const c of pendientes) {
    try {
      if (c.estado === EstadoCfeEmitido.DUDOSO || c.estado === EstadoCfeEmitido.EMITIENDO) {
        const r = await enCola(() => resolverDudoso(c.id, c.numeroInterno, c.error ?? "Dudoso"));
        if (r === "EMITIDO") await alEmitirse(c.id, c.emitidoPorId);
        else if (Date.now() - c.createdAt.getTime() > MINUTOS_PARA_DAR_POR_NO_EMITIDO * 60_000) {
          await prisma.cfeEmitido.update({
            where: { id: c.id },
            data: { estado: EstadoCfeEmitido.ERROR, error: `No apareció en Biller después de ${MINUTOS_PARA_DAR_POR_NO_EMITIDO} minutos: no se emitió. ${c.error ?? ""}`.trim() },
          });
        }
        continue;
      }
      await enCola(() => actualizarEstadoDgi(c.id));
    } catch (err) {
      console.error(`[biller-cfe] ${c.id}:`, (err as Error).message);
    }
  }
  return { consultados: pendientes.length };
}

export async function actualizarEstadoDgi(cfeId: string) {
  const c = await prisma.cfeEmitido.findUniqueOrThrow({ where: { id: cfeId } });
  if (!c.billerId) return serializarCfe(c);
  const r = await billerFetch("GET", `/v3/comprobantes/detalle?id=${encodeURIComponent(c.billerId)}`);
  if (r.status !== 200) throw new Error(mensajeBiller(r));
  const d = r.body as Obj;
  const estadoDgi = typeof d.estado === "string" ? d.estado : null;
  let estado: EstadoCfeEmitido = c.estado;
  // Nombres reales vistos en test:
  //  - "Pendiente DGI" → "Aceptado DGI".
  //  - "Envío no corresponde": e-Ticket chico que no se manda a DGI uno por uno
  //    (va en el reporte diario). Es válido: cuenta como aceptado.
  // El nombre de un rechazo no está confirmado. Un texto desconocido NO se toma
  // como rechazo: queda esperando, se muestra tal cual y se loguea.
  if (estadoDgi) {
    if (/aceptado|no corresponde/i.test(estadoDgi)) estado = EstadoCfeEmitido.ACEPTADO;
    else if (/rechaz/i.test(estadoDgi)) estado = EstadoCfeEmitido.RECHAZADO;
    else {
      estado = EstadoCfeEmitido.ESPERANDO_DGI;
      if (!/pendiente|esperando/i.test(estadoDgi)) console.warn(`[biller-cfe] estado DGI desconocido en ${c.id}: "${estadoDgi}"`);
    }
  }
  const tasa = d.tasa_cambio != null ? Number(d.tasa_cambio) : null;
  const act = await prisma.cfeEmitido.update({
    where: { id: c.id },
    data: {
      estado,
      estadoDgi,
      tasaCambio: tasa != null && Number.isFinite(tasa) ? tasa : undefined,
      ultimaConsultaEn: new Date(),
    },
  });

  if (estado !== c.estado && estado === EstadoCfeEmitido.ACEPTADO) {
    await guardarPdf(c.id).catch((err) => console.error(`[biller-cfe] PDF ${c.id}:`, (err as Error).message));
  }
  if (estado !== c.estado && estado === EstadoCfeEmitido.RECHAZADO) {
    if (!c.referenciaId) {
      await prisma.project.update({ where: { id: c.projectId }, data: { facturaEmitida: false, facturaEmitidaEn: null } });
    }
    await createAuditEntry({
      entityType: AuditEntityType.cfe_emitido,
      entityId: c.id,
      projectId: c.projectId,
      userId: c.emitidoPorId,
      action: AuditAction.updated,
      description: `DGI rechazó ${ETIQUETA_TIPO[c.tipoCfe]} ${c.serie}-${c.numero}: ${estadoDgi}`,
    });
  }
  return serializarCfe(act);
}

// ── PDF ──────────────────────────────────────────────────────────────────────

/** Baja el PDF de Biller y lo guarda como archivo del proyecto (una vez). */
export async function guardarPdf(cfeId: string) {
  const c = await prisma.cfeEmitido.findUniqueOrThrow({ where: { id: cfeId } });
  if (c.pdfAttachmentId) {
    const a = await prisma.fileAttachment.findFirst({ where: { id: c.pdfAttachmentId, deletedAt: null } });
    if (a) return a;
  }
  if (!c.billerId) return null;
  const pdf = await enCola(() => bajarPdfBiller(c.billerId!));
  if (!pdf) return null;

  const esNC = c.referenciaId != null;
  const nombre = `${esNC ? "Nota de credito" : "Factura"} ${c.serie}-${c.numero}.pdf`;
  const saved = await saveBufferAsAttachment(pdf, nombre, "application/pdf", c.projectId);

  // La factura reemplaza a la que se hubiera adjuntado a mano: hay una sola.
  if (!esNC) {
    await prisma.fileAttachment.updateMany({
      where: { projectId: c.projectId, toolSource: FACTURA_CLIENTE_SOURCE, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
  const a = await prisma.fileAttachment.create({
    data: {
      projectId: c.projectId,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      tipo: FileAttachmentTipo.OTRO,
      toolSource: esNC ? NOTA_CREDITO_SOURCE : FACTURA_CLIENTE_SOURCE,
      toolEntityId: c.id,
      uploadedById: c.emitidoPorId,
    },
  });
  await prisma.cfeEmitido.update({ where: { id: c.id }, data: { pdfAttachmentId: a.id } });
  return a;
}

// ── Lectura ──────────────────────────────────────────────────────────────────

export function serializarCfe(c: {
  id: string; tipoCfe: number; estado: EstadoCfeEmitido; estadoDgi: string | null;
  serie: string | null; numero: number | null; fechaEmision: Date; moneda: Moneda;
  total: Prisma.Decimal; tasaCambio?: Prisma.Decimal | null; clienteNombre: string;
  clienteDocumento: string | null; referenciaId: string | null; motivo: string | null;
  error: string | null; pdfAttachmentId: string | null; createdAt: Date;
}) {
  return {
    id: c.id,
    tipoCfe: c.tipoCfe,
    tipoLabel: ETIQUETA_TIPO[c.tipoCfe] ?? `CFE ${c.tipoCfe}`,
    esNotaCredito: c.referenciaId != null,
    referenciaId: c.referenciaId,
    estado: c.estado,
    estadoDgi: c.estadoDgi,
    serie: c.serie,
    numero: c.numero,
    fechaEmision: toDateOnlyString(c.fechaEmision),
    moneda: c.moneda,
    total: Number(c.total),
    tasaCambio: c.tasaCambio != null ? Number(c.tasaCambio) : null,
    clienteNombre: c.clienteNombre,
    clienteDocumento: c.clienteDocumento,
    motivo: c.motivo,
    error: c.error,
    tienePdf: c.pdfAttachmentId != null,
    creadoEn: c.createdAt.toISOString(),
  };
}

export async function cfesDelProyecto(projectId: string) {
  const filas = await prisma.cfeEmitido.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { emitidoPor: { select: { name: true } } },
  });
  return filas.map((c) => ({ ...serializarCfe(c), emitidoPor: c.emitidoPor.name }));
}
