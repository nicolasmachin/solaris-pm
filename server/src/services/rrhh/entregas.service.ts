// Entrega de materiales con firma: ropa de trabajo, equipos de protección,
// herramientas.
//
// RRHH registra qué se entregó (queda PENDIENTE_FIRMA) y la persona firma en
// la pantalla —desde su Mi legajo, o en persona en el dispositivo de quien
// entrega—. Al firmar se guarda la firma (PNG) y se arma la constancia en PDF,
// que entra al legajo como documento ENTREGA_EPP ya validado. Una entrega
// firmada no se edita: si hubo un error, se anula y se registra otra.

import {
  AuditAction,
  AuditEntityType,
  EntregaEstado,
  LegajoDocumentoEstado,
  LegajoDocumentoTipo,
  NotificationType,
  Prisma,
} from "@prisma/client";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { saveBufferAsAttachment } from "../file-storage.service.js";
import { createNotification } from "../notification.service.js";
import { LOGO_VOLTIA_DATA_URI } from "../reportesFv/pdf/logo.js";
import { asegurarLegajo, esGestor, type RrhhUser } from "./rrhh.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, "..", "unifilarSvg", "fonts");
const ROBOTO_REGULAR = path.join(FONTS_DIR, "Roboto-Regular.ttf");
const ROBOTO_BOLD = path.join(FONTS_DIR, "Roboto-Bold.ttf");
const LOGO = Buffer.from(LOGO_VOLTIA_DATA_URI.replace(/^data:image\/\w+;base64,/, ""), "base64");

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const MAX_FIRMA_BYTES = 1024 * 1024;

export type ItemEntrega = { descripcion: string; cantidad: number; detalle?: string | null };

/** Lo que más se entrega: el formulario lo ofrece como sugerencias. */
export const ITEMS_SUGERIDOS = [
  "Casco",
  "Arnés",
  "Línea de vida",
  "Botas de seguridad",
  "Guantes",
  "Lentes de seguridad",
  "Protector auditivo",
  "Ropa de trabajo",
  "Campera",
  "Chaleco reflectivo",
  "Herramientas",
];

const entregaSelect = {
  id: true,
  legajoId: true,
  fecha: true,
  items: true,
  observaciones: true,
  estado: true,
  firmadaAt: true,
  firmaPresencial: true,
  documentoId: true,
  createdAt: true,
  entregadoPor: { select: { name: true } },
} satisfies Prisma.EntregaMaterialesSelect;

type EntregaRow = Prisma.EntregaMaterialesGetPayload<{ select: typeof entregaSelect }>;

function serializar(e: EntregaRow) {
  return {
    id: e.id,
    fecha: e.fecha.toISOString().slice(0, 10),
    items: e.items as ItemEntrega[],
    observaciones: e.observaciones,
    estado: e.estado,
    firmadaAt: e.firmadaAt?.toISOString() ?? null,
    firmaPresencial: e.firmaPresencial,
    // La constancia es un documento más del legajo: se descarga desde ahí.
    documentoId: e.documentoId,
    entregadoPor: e.entregadoPor.name,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function entregasDeLegajo(legajoId: string) {
  const rows = await prisma.entregaMateriales.findMany({
    where: { legajoId, estado: { not: EntregaEstado.ANULADA } },
    orderBy: { fecha: "desc" },
    select: entregaSelect,
  });
  return rows.map(serializar);
}

export async function misEntregas(user: RrhhUser) {
  const legajo = await asegurarLegajo(user.id);
  return entregasDeLegajo(legajo.id);
}

function validarItems(items: ItemEntrega[]) {
  const limpios = items
    .map((i) => ({ descripcion: i.descripcion.trim(), cantidad: i.cantidad, detalle: i.detalle?.trim() || null }))
    .filter((i) => i.descripcion);
  if (limpios.length === 0) throw badRequest("SIN_ITEMS", "Cargá al menos un material");
  if (limpios.some((i) => !Number.isInteger(i.cantidad) || i.cantidad < 1 || i.cantidad > 1000)) {
    throw badRequest("CANTIDAD_INVALIDA", "Cada material lleva una cantidad entera mayor que cero");
  }
  return limpios;
}

/** RRHH registra una entrega; queda esperando la firma y se le avisa a la persona. */
export async function registrarEntrega(
  userId: string,
  datos: { fecha: string; items: ItemEntrega[]; observaciones?: string | null },
  gestor: RrhhUser,
) {
  const legajo = await asegurarLegajo(userId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) throw badRequest("FECHA_INVALIDA", "Fecha inválida (AAAA-MM-DD)");
  const e = await prisma.entregaMateriales.create({
    data: {
      legajoId: legajo.id,
      fecha: new Date(`${datos.fecha}T00:00:00.000Z`),
      items: validarItems(datos.items) as unknown as Prisma.InputJsonValue,
      observaciones: datos.observaciones?.trim() || null,
      entregadoPorId: gestor.id,
    },
    select: entregaSelect,
  });
  if (userId !== gestor.id) {
    await createNotification({
      userId,
      type: NotificationType.legajo_documento,
      title: "Tenés una entrega de materiales para firmar",
      message: "Revisá lo que se te entregó y firmalo en Mi legajo.",
      link: "/mi-legajo",
    }).catch(() => undefined);
  }
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: legajo.id,
    userId: gestor.id,
    action: AuditAction.created,
    description: `Registró una entrega de materiales (${e.id})`,
  });
  return serializar(e);
}

export async function anularEntrega(id: string, gestor: RrhhUser) {
  const e = await prisma.entregaMateriales.findUnique({ where: { id }, select: { legajoId: true, estado: true } });
  if (!e) throw notFound("ENTREGA_NOT_FOUND", "Entrega no encontrada");
  await prisma.entregaMateriales.update({ where: { id }, data: { estado: EntregaEstado.ANULADA } });
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: e.legajoId,
    userId: gestor.id,
    action: AuditAction.status_changed,
    description: `Anuló una entrega de materiales${e.estado === EntregaEstado.FIRMADA ? " ya firmada (la constancia queda en el legajo)" : ""}`,
  });
}

function decodificarFirma(dataUrl: string) {
  const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 100 || !buf.subarray(0, 4).equals(PNG_MAGIC)) throw badRequest("FIRMA_INVALIDA", "La firma no llegó bien: volvé a firmar");
  if (buf.length > MAX_FIRMA_BYTES) throw badRequest("FIRMA_INVALIDA", "La firma es demasiado grande");
  return buf;
}

function fmtFecha(d: Date) {
  return d.toISOString().slice(0, 10).split("-").reverse().join("/");
}

function fmtFechaHora(d: Date) {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "America/Montevideo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function constanciaPdf(input: {
  nombre: string;
  cedula: string | null;
  fecha: Date;
  items: ItemEntrega[];
  observaciones: string | null;
  entregadoPor: string;
  firma: Buffer;
  firmadaAt: Date;
  presencial: boolean;
  entregaId: string;
}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `Constancia de entrega — ${input.nombre}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const reg = fs.existsSync(ROBOTO_REGULAR) ? "Roboto" : "Helvetica";
    const bold = fs.existsSync(ROBOTO_BOLD) ? "Roboto-Bold" : "Helvetica-Bold";
    if (reg === "Roboto") doc.registerFont("Roboto", ROBOTO_REGULAR);
    if (bold === "Roboto-Bold") doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

    doc.image(LOGO, 56, 48, { height: 30 });
    doc.moveDown(3);
    doc.font(bold).fontSize(16).fillColor("#111").text("Constancia de entrega de materiales");
    doc.moveDown(0.6);
    doc.font(reg).fontSize(10.5).fillColor("#333");
    doc.text(`Fecha de entrega: ${fmtFecha(input.fecha)}`);
    doc.text(`Recibe: ${input.nombre}${input.cedula ? ` · C.I. ${input.cedula}` : ""}`);
    doc.text(`Entrega: ${input.entregadoPor}, por Voltia`);
    doc.moveDown(1);

    // Tabla: cantidad · material · detalle.
    const x0 = 56;
    const anchos = [70, 200, 213];
    const fila = (cols: string[], negrita = false) => {
      const y = doc.y;
      doc.font(negrita ? bold : reg).fontSize(10);
      let x = x0;
      let alto = 0;
      cols.forEach((c, i) => {
        doc.text(c, x + 4, y + 4, { width: anchos[i] - 8 });
        alto = Math.max(alto, doc.y - y);
        x += anchos[i];
      });
      doc.moveTo(x0, y + alto + 6).lineTo(x0 + anchos.reduce((a, b) => a + b), y + alto + 6).strokeColor("#ccc").stroke();
      doc.y = y + alto + 8;
    };
    fila(["Cantidad", "Material", "Detalle"], true);
    for (const it of input.items) fila([String(it.cantidad), it.descripcion, it.detalle ?? ""]);
    doc.x = x0;
    if (input.observaciones) {
      doc.moveDown(0.8);
      doc.font(bold).fontSize(10).text("Observaciones");
      doc.font(reg).text(input.observaciones);
    }
    doc.moveDown(1.2);
    doc.font(reg).fontSize(10.5).fillColor("#111")
      .text("Declaro haber recibido los materiales detallados en esta constancia.", { width: 483 });
    doc.moveDown(1);
    const yFirma = doc.y;
    doc.image(input.firma, x0, yFirma, { fit: [220, 90] });
    doc.moveTo(x0, yFirma + 96).lineTo(x0 + 220, yFirma + 96).strokeColor("#555").stroke();
    doc.font(reg).fontSize(9).fillColor("#555").text(input.nombre, x0, yFirma + 100);
    doc.moveDown(2);
    doc.fontSize(8).fillColor("#777").text(
      `Firmado en Voltia PM el ${fmtFechaHora(input.firmadaAt)}${input.presencial ? `, en persona ante ${input.entregadoPor}` : ", desde su usuario"}. Entrega ${input.entregaId}.`,
      x0,
      undefined,
      { width: 483 },
    );
    doc.end();
  });
}

/**
 * Firma de una entrega. La puede hacer la persona dueña desde su usuario, o
 * quien gestiona RRHH en su dispositivo con la persona delante (presencial).
 */
export async function firmarEntrega(id: string, firmaDataUrl: string, user: RrhhUser) {
  const e = await prisma.entregaMateriales.findUnique({
    where: { id },
    select: {
      ...entregaSelect,
      legajo: { select: { id: true, userId: true, cedula: true, user: { select: { name: true } } } },
      entregadoPorId: true,
    },
  });
  if (!e || e.estado === EntregaEstado.ANULADA) throw notFound("ENTREGA_NOT_FOUND", "Entrega no encontrada");
  if (e.estado === EntregaEstado.FIRMADA) throw badRequest("YA_FIRMADA", "Esta entrega ya está firmada");
  const esDueno = e.legajo.userId === user.id;
  if (!esDueno && !(await esGestor(user))) throw forbidden("Solo la persona que recibe puede firmar");

  const firma = decodificarFirma(firmaDataUrl);
  const firmadaAt = new Date();
  const carpeta = `rrhh/${e.legajo.id}`;
  const firmaGuardada = await saveBufferAsAttachment(firma, "firma.png", "image/png", carpeta);
  const pdf = await constanciaPdf({
    nombre: e.legajo.user.name,
    cedula: e.legajo.cedula,
    fecha: e.fecha,
    items: e.items as ItemEntrega[],
    observaciones: e.observaciones,
    entregadoPor: e.entregadoPor.name,
    firma,
    firmadaAt,
    presencial: !esDueno,
    entregaId: e.id,
  });
  const nombrePdf = `Constancia de entrega ${fmtFecha(e.fecha).replace(/\//g, "-")}.pdf`;
  const pdfGuardado = await saveBufferAsAttachment(pdf, nombrePdf, "application/pdf", carpeta);

  const documento = await prisma.legajoDocumento.create({
    data: {
      legajoId: e.legajo.id,
      tipo: LegajoDocumentoTipo.ENTREGA_EPP,
      titulo: `Entrega de materiales ${fmtFecha(e.fecha)}`,
      estado: LegajoDocumentoEstado.VALIDADO,
      filename: pdfGuardado.filename,
      storedFilename: pdfGuardado.storedFilename,
      mimeType: pdfGuardado.mimeType,
      sizeBytes: pdfGuardado.sizeBytes,
      url: pdfGuardado.url,
      subidoPorId: e.entregadoPorId,
      validadoPorId: e.entregadoPorId,
      validadoAt: firmadaAt,
    },
    select: { id: true },
  });
  const actualizada = await prisma.entregaMateriales.update({
    where: { id },
    data: {
      estado: EntregaEstado.FIRMADA,
      firmaUrl: firmaGuardada.url,
      firmadaAt,
      firmaPresencial: !esDueno,
      documentoId: documento.id,
    },
    select: entregaSelect,
  });
  await createAuditEntry({
    entityType: AuditEntityType.legajo,
    entityId: e.legajo.id,
    userId: user.id,
    action: AuditAction.status_changed,
    description: `Firmó la entrega de materiales del ${fmtFecha(e.fecha)}${esDueno ? "" : " (en persona)"}`,
  });
  return serializar(actualizada);
}
