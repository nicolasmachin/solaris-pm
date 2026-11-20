// Sección "Comercial" de Trámites UTE: lo que se le pide a UTE Comercial y no
// es la habilitación (aumentos, suministros nuevos, provisorios…). Los que se
// mandan con el formulario desde Voltia PM se crean solos al enviar
// (`ute-suministro.routes.ts` para un proyecto; las rutas de /contactos de este
// archivo para un cliente sin proyecto); acá se cargan a mano los que se
// pidieron por otro lado y se les sigue el estado.
//
// Cada trámite es de un proyecto o de un contacto del CRM, nunca de ninguno.
// El pedido para un contacto trae su propia búsqueda y alta de contactos
// porque el rol TRAMITACION_UTE no tiene permiso sobre el CRM.

import fs from "node:fs";

import {
  Action,
  AuditAction,
  AuditEntityType,
  FileAttachmentTipo,
  Module,
  Prisma,
  UteTramiteComercialEstado,
  UteTramiteComercialTipo,
} from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntriesForChanges, createAuditEntry } from "../services/audit.service.js";
import { crearContacto, esNombreDeEmpresa } from "../services/crm/contactos.service.js";
import { emptyContext, resolveFirmaContext, type EmailTemplateContext } from "../services/email/context.service.js";
import { SUMINISTRO_INDIVIDUAL_KEY } from "../services/email/seed-templates.js";
import { sendTemplatedEmail } from "../services/email/send.service.js";
import {
  deleteStoredFile,
  getStoredFilePath,
  saveBufferAsAttachment,
} from "../services/file-storage.service.js";
import { convertirHeicABufferJpeg, esHeic } from "../services/heic.service.js";
import { ESTADO_LABEL, TIPO_LABEL, hoyComoDia, registrarTramiteEnviado } from "../services/ute-comercial.service.js";
import { extractFromDocument } from "../services/ute-extract/index.js";
import { datosFormularioDesdeContexto } from "../services/ute-suministro/mapping.js";
import {
  completarFormularioSuministro,
  nombreArchivoFormulario,
} from "../services/ute-suministro/xlsx.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import {
  TOOL_SOURCE as TOOL_SOURCE_FORMULARIO,
  XLSX_MIME,
  contextSchema,
  enviarSchema,
  puedeEnviar,
  puedeVer,
} from "./ute-suministro.routes.js";

// La factura de UTE que se sube en el pedido para un contacto: queda guardada
// sin proyecto. Mientras no se envía, `toolEntityId` es el contacto (pendiente);
// al enviar pasa a ser el trámite y se descarga desde su fila.
const TOOL_SOURCE_FACTURA = "ute-comercial-factura";
const FUENTES_ARCHIVOS = [TOOL_SOURCE_FORMULARIO, TOOL_SOURCE_FACTURA];
const carpetaContacto = (contactoId: string) => `ute-comercial/${contactoId}`;

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform((v) => new Date(`${v}T00:00:00.000Z`));
const textoOpcional = z
  .string()
  .trim()
  .max(5000)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const createSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    contactoId: z.string().min(1).optional(),
    suministro: z.number().int().min(1).max(20).optional(),
    tipo: z.nativeEnum(UteTramiteComercialTipo),
    detalle: textoOpcional,
    estado: z.nativeEnum(UteTramiteComercialEstado).optional(),
    caseNumber: textoOpcional,
    notes: textoOpcional,
    solicitadoEl: dia.nullable().optional(),
  })
  .strict()
  .refine((b) => Boolean(b.projectId) !== Boolean(b.contactoId), {
    message: "El trámite tiene que ser de un proyecto o de un contacto (uno de los dos)",
  });

const patchSchema = z
  .object({
    suministro: z.number().int().min(1).max(20).optional(),
    tipo: z.nativeEnum(UteTramiteComercialTipo).optional(),
    detalle: textoOpcional,
    estado: z.nativeEnum(UteTramiteComercialEstado).optional(),
    caseNumber: textoOpcional,
    notes: textoOpcional,
    solicitadoEl: dia.nullable().optional(),
    darEnviadoEl: dia.nullable().optional(),
    resueltoEl: dia.nullable().optional(),
  })
  .strict();

const include = {
  project: { select: { id: true, code: true, clientName: true, locationCity: true } },
  contacto: { select: { id: true, nombre: true, telefono: true, email: true, documento: true } },
} satisfies Prisma.UteTramiteComercialInclude;

type Fila = Prisma.UteTramiteComercialGetPayload<{ include: typeof include }>;

type Archivo = { id: string; filename: string; clase: "formulario" | "factura" };

// Los archivos de cada trámite: el formulario que se mandó y, en los pedidos
// para un contacto, la factura de UTE que se subió. Van por `fileAttachmentId`
// o por `toolEntityId` = el trámite.
async function archivosDe(filas: { id: string; fileAttachmentId: string | null }[]) {
  const porTramite = new Map<string, Archivo[]>();
  if (filas.length === 0) return porTramite;
  const ids = filas.map((f) => f.id);
  const adjuntos = await prisma.fileAttachment.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: { in: filas.map((f) => f.fileAttachmentId).filter((x): x is string => !!x) } },
        { toolSource: { in: FUENTES_ARCHIVOS }, toolEntityId: { in: ids } },
      ],
    },
    select: { id: true, filename: true, toolSource: true, toolEntityId: true },
    orderBy: { createdAt: "asc" },
  });
  for (const f of filas) {
    const suyos = adjuntos.filter((a) => a.id === f.fileAttachmentId || a.toolEntityId === f.id);
    porTramite.set(
      f.id,
      suyos.map((a) => ({
        id: a.id,
        filename: a.filename,
        clase: a.toolSource === TOOL_SOURCE_FACTURA ? "factura" : "formulario",
      })),
    );
  }
  return porTramite;
}

// Días que lleva (o llevó) con UTE: desde el pedido hasta hoy, o hasta que se
// resolvió. Sin fecha de pedido no hay cuenta.
function serializar(t: Fila, archivos: Archivo[] = []) {
  const hasta = t.resueltoEl ?? hoyComoDia();
  const dias = t.solicitadoEl
    ? Math.max(0, Math.round((hasta.getTime() - t.solicitadoEl.getTime()) / 86_400_000))
    : null;
  return { ...t, dias, archivos };
}

async function serializarUno(t: Fila) {
  const archivos = await archivosDe([t]);
  return serializar(t, archivos.get(t.id) ?? []);
}

async function contactoOTirar(contactoId: string) {
  const c = await prisma.contacto.findFirst({
    where: { id: contactoId, deletedAt: null },
    select: { id: true, nombre: true, telefono: true, email: true, documento: true },
  });
  if (!c) throw notFound("CONTACTO_NO_ENCONTRADO", "El contacto no existe");
  return c;
}

const contactoParams = z.object({ contactoId: z.string().min(1) });

const contactoBody = z
  .object({
    nombre: z.string().trim().min(1, "El cliente necesita un nombre").max(200),
    telefono: z.string().trim().max(60).nullable().optional(),
    email: z.string().trim().max(200).nullable().optional(),
    documento: z.string().trim().max(40).nullable().optional(),
  })
  .strict();

const enviarContactoSchema = enviarSchema.extend({
  // La factura de UTE que se subió en esta pantalla, si se subió.
  facturaAttachmentId: z.string().min(1).optional(),
});

// Un RUT uruguayo tiene 12 dígitos; una cédula, 7 u 8.
function esEmpresaContacto(c: { nombre: string; documento: string | null }) {
  const digitos = (c.documento ?? "").replace(/\D/g, "");
  return digitos.length === 12 || esNombreDeEmpresa(c.nombre);
}

// "59899123456" → "099123456": UTE lo espera como se marca en Uruguay.
function telefonoLocal(t: string | null) {
  if (!t) return "";
  return t.startsWith("598") && t.length >= 11 ? `0${t.slice(3)}` : t;
}

const LABELS: Record<string, string> = {
  suministro: "suministro",
  tipo: "tipo de trámite",
  detalle: "detalle",
  estado: "estado",
  caseNumber: "número de caso",
  notes: "notas",
  solicitadoEl: "fecha de pedido",
  darEnviadoEl: "fecha de envío del DAR",
  resueltoEl: "fecha de resolución",
};

export async function registerUteComercialRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get(
    "/ute-tramites-comerciales",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.VIEW) },
    async (request) => {
      const query = z.object({ projectId: z.string().min(1).optional() }).parse(request.query);
      const rows = await prisma.uteTramiteComercial.findMany({
        where: {
          deletedAt: null,
          ...(query.projectId
            ? { projectId: query.projectId, project: { deletedAt: null } }
            : // Los de proyecto, si el proyecto sigue vivo; los de contacto (o
              // los que se quedaron sin contacto porque lo borraron), siempre.
              { OR: [{ project: { deletedAt: null } }, { projectId: null }] }),
        },
        include,
        orderBy: [{ solicitadoEl: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      });
      const archivos = await archivosDe(rows);
      return rows.map((r) => serializar(r, archivos.get(r.id) ?? []));
    },
  );

  app.post(
    "/ute-tramites-comerciales",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const body = createSchema.parse(request.body);
      if (body.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: body.projectId, deletedAt: null },
          select: { id: true },
        });
        if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      } else if (body.contactoId) {
        await contactoOTirar(body.contactoId);
      }
      if (body.tipo === UteTramiteComercialTipo.OTRO && !body.detalle) {
        throw badRequest("DETALLE_REQUERIDO", "Para un trámite de tipo «Otro» hay que decir qué es");
      }

      const estado = body.estado ?? UteTramiteComercialEstado.PEDIDO;
      // Si se carga como ya pedido y no se dice cuándo, se toma hoy: sin
      // fecha de pedido la sección no puede decir cuánto lleva.
      const solicitadoEl =
        body.solicitadoEl ?? (estado === UteTramiteComercialEstado.A_PEDIR ? null : hoyComoDia());

      const creado = await prisma.uteTramiteComercial.create({
        data: {
          projectId: body.projectId ?? null,
          contactoId: body.projectId ? null : body.contactoId ?? null,
          suministro: body.suministro ?? 1,
          tipo: body.tipo,
          detalle: body.detalle ?? null,
          estado,
          caseNumber: body.caseNumber ?? null,
          notes: body.notes ?? null,
          solicitadoEl,
          resueltoEl: estado === UteTramiteComercialEstado.RESUELTO ? hoyComoDia() : null,
          createdById: user.id,
        },
        include,
      });

      await createAuditEntry({
        entityType: AuditEntityType.ute_tramite_comercial,
        entityId: creado.id,
        projectId: creado.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Cargó un trámite con UTE Comercial: ${TIPO_LABEL[creado.tipo]}${
          creado.detalle ? ` (${creado.detalle})` : ""
        }${creado.contacto ? ` para ${creado.contacto.nombre} (sin proyecto)` : ""}`,
        metadata: creado.contactoId ? { contactoId: creado.contactoId } : undefined,
      });

      reply.code(201);
      return serializar(creado);
    },
  );

  app.patch(
    "/ute-tramites-comerciales/:id",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = patchSchema.parse(request.body);
      const actual = await prisma.uteTramiteComercial.findFirst({ where: { id, deletedAt: null } });
      if (!actual) throw notFound("TRAMITE_NOT_FOUND", "Trámite no encontrado");

      const data: Prisma.UteTramiteComercialUncheckedUpdateInput = {};
      for (const k of Object.keys(body) as (keyof typeof body)[]) {
        if (body[k] !== undefined) (data as Record<string, unknown>)[k] = body[k];
      }
      const tipoFinal = body.tipo ?? actual.tipo;
      const detalleFinal = body.detalle !== undefined ? body.detalle : actual.detalle;
      if (tipoFinal === UteTramiteComercialTipo.OTRO && !detalleFinal) {
        throw badRequest("DETALLE_REQUERIDO", "Para un trámite de tipo «Otro» hay que decir qué es");
      }

      // Las fechas acompañan al estado si no se cargaron a mano: marcarlo
      // pedido fecha el pedido hoy; marcarlo resuelto fecha la resolución.
      if (body.estado && body.estado !== actual.estado) {
        if (body.estado !== UteTramiteComercialEstado.A_PEDIR && !actual.solicitadoEl && body.solicitadoEl === undefined) {
          data.solicitadoEl = hoyComoDia();
        }
        if (body.estado === UteTramiteComercialEstado.RESUELTO && !actual.resueltoEl && body.resueltoEl === undefined) {
          data.resueltoEl = hoyComoDia();
        }
        // Reabrir un resuelto le saca la fecha de resolución.
        if (
          actual.estado === UteTramiteComercialEstado.RESUELTO &&
          body.estado !== UteTramiteComercialEstado.RESUELTO &&
          body.resueltoEl === undefined
        ) {
          data.resueltoEl = null;
        }
      }

      const actualizado = await prisma.uteTramiteComercial.update({ where: { id }, data, include });

      const viejo = actual as unknown as Record<string, unknown>;
      const nuevo = actualizado as unknown as Record<string, unknown>;
      const campos = Object.keys(data);
      await createAuditEntriesForChanges({
        entityType: AuditEntityType.ute_tramite_comercial,
        entityId: id,
        projectId: actual.projectId,
        userId: user.id,
        oldData: Object.fromEntries(campos.map((k) => [k, viejo[k]])),
        newData: Object.fromEntries(campos.map((k) => [k, nuevo[k]])),
        labels: LABELS,
        formatter: ({ field, label, oldValue, newValue }) => {
          if (field === "estado") {
            const de = ESTADO_LABEL[oldValue as UteTramiteComercialEstado] ?? oldValue;
            const a = ESTADO_LABEL[newValue as UteTramiteComercialEstado] ?? newValue;
            return `Trámite comercial (${TIPO_LABEL[actualizado.tipo]}): estado de ${de} a ${a}`;
          }
          // Las fechas llegan como ISO: se muestran dd/mm/aaaa.
          const fmt = (v: string | null) =>
            !v ? "vacío" : /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10).split("-").reverse().join("/") : v;
          return `Trámite comercial (${TIPO_LABEL[actualizado.tipo]}): ${label} de ${fmt(oldValue)} a ${fmt(newValue)}`;
        },
      });

      return serializarUno(actualizado);
    },
  );

  app.delete(
    "/ute-tramites-comerciales/:id",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.DELETE) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
      const actual = await prisma.uteTramiteComercial.findFirst({ where: { id, deletedAt: null } });
      if (!actual) throw notFound("TRAMITE_NOT_FOUND", "Trámite no encontrado");
      await prisma.uteTramiteComercial.update({ where: { id }, data: { deletedAt: new Date() } });
      await createAuditEntry({
        entityType: AuditEntityType.ute_tramite_comercial,
        entityId: id,
        projectId: actual.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Borró un trámite con UTE Comercial: ${TIPO_LABEL[actual.tipo]}`,
      });
      return { ok: true };
    },
  );
  // ─── Archivos del trámite ──────────────────────────────────────────────────

  // Descarga el formulario enviado o la factura de un trámite. Sirve sobre todo
  // para los trámites sin proyecto, cuyos archivos no están en ningún
  // "Documentos del proyecto".
  app.get(
    "/ute-tramites-comerciales/:id/archivos/:attachmentId",
    { preHandler: authorize(Module.TRAMITES_UTE, Action.VIEW) },
    async (request, reply) => {
      const { id, attachmentId } = z
        .object({ id: z.string().min(1), attachmentId: z.string().min(1) })
        .parse(request.params);
      const tramite = await prisma.uteTramiteComercial.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, fileAttachmentId: true },
      });
      if (!tramite) throw notFound("TRAMITE_NOT_FOUND", "Trámite no encontrado");
      const adjunto = await prisma.fileAttachment.findFirst({
        where: {
          id: attachmentId,
          deletedAt: null,
          OR: [
            ...(tramite.fileAttachmentId === attachmentId ? [{ id: attachmentId }] : []),
            { toolSource: { in: FUENTES_ARCHIVOS }, toolEntityId: id },
          ],
        },
      });
      if (!adjunto) throw notFound("ARCHIVO_NO_ENCONTRADO", "Ese archivo no es de este trámite");
      const absolutePath = getStoredFilePath(adjunto.url);
      if (!fs.existsSync(absolutePath)) {
        throw notFound("ARCHIVO_NO_ENCONTRADO", "El archivo no está en el almacenamiento");
      }
      reply
        .header("Content-Type", adjunto.mimeType)
        .header("Content-Disposition", contentDisposition("attachment", adjunto.filename));
      return reply.send(fs.createReadStream(absolutePath));
    },
  );

  // ─── Pedido para un cliente sin proyecto ───────────────────────────────────
  // Mismo permiso que el formulario para un proyecto (`ute-suministro.routes.ts`):
  // ONBOARDING o TRAMITES_UTE.

  // Buscar contactos del CRM. Propio de esta sección: TRAMITACION_UTE no tiene
  // permiso de CRM, y acá solo hace falta nombre, teléfono, mail y documento.
  app.get("/ute-tramites-comerciales/contactos", { preHandler: puedeVer }, async (request) => {
    const { q } = z.object({ q: z.string().trim().max(100).optional() }).parse(request.query);
    const texto = q ?? "";
    const digitos = texto.replace(/\D/g, "");
    return prisma.contacto.findMany({
      where: {
        deletedAt: null,
        ...(texto
          ? {
              OR: [
                { nombre: { contains: texto, mode: "insensitive" } },
                { email: { contains: texto, mode: "insensitive" } },
                { documento: { contains: texto } },
                ...(digitos.length >= 3 ? [{ telefono: { contains: digitos } }] : []),
              ],
            }
          : {}),
      },
      select: { id: true, nombre: true, telefono: true, email: true, documento: true },
      orderBy: { nombre: "asc" },
      take: 20,
    });
  });

  // Alta de un cliente nuevo como contacto del CRM (las mismas reglas que el
  // CRM: teléfono normalizado y que no sea de otro contacto).
  app.post("/ute-tramites-comerciales/contactos", { preHandler: puedeEnviar }, async (request, reply) => {
    const user = ensureUser(request);
    const body = contactoBody.parse(request.body);
    const c = await crearContacto(body, user.id);
    reply.code(201);
    return { id: c.id, nombre: c.nombre, telefono: c.telefono, email: c.email, documento: c.documento };
  });

  // Datos con que arranca el formulario: los del contacto y la firma del
  // usuario; el resto en blanco (o los valores por defecto del formulario).
  app.get(
    "/ute-tramites-comerciales/contactos/:contactoId/suministro-individual/contexto",
    { preHandler: puedeVer },
    async (request) => {
      const user = ensureUser(request);
      const { contactoId } = contactoParams.parse(request.params);
      const contacto = await contactoOTirar(contactoId);
      const ctx = emptyContext();
      const esEmpresa = esEmpresaContacto(contacto);
      ctx.cliente = {
        nombre: contacto.nombre,
        ci: contacto.documento ?? "",
        telefono: telefonoLocal(contacto.telefono),
        email: contacto.email ?? "",
        esEmpresa,
        documento: esEmpresa ? "RUT" : "CI",
      };
      if (esEmpresa) {
        ctx.tecnica.destino = "Comercial.";
        ctx.tecnica.actividad = "General";
      }
      ctx.firma = await resolveFirmaContext(user.id);
      return { contacto, context: ctx };
    },
  );

  app.post(
    "/ute-tramites-comerciales/contactos/:contactoId/suministro-individual/preview.xlsx",
    { preHandler: puedeVer },
    async (request, reply) => {
      const { contactoId } = contactoParams.parse(request.params);
      const contacto = await contactoOTirar(contactoId);
      const context = contextSchema.parse(
        (request.body as { context?: unknown } | undefined)?.context,
      ) as EmailTemplateContext;
      const buffer = await completarFormularioSuministro(datosFormularioDesdeContexto(context));
      const filename = nombreArchivoFormulario(contacto.nombre, context.tecnica.esAumento);
      reply
        .header("Content-Type", XLSX_MIME)
        .header("Content-Disposition", contentDisposition("attachment", filename))
        .send(buffer);
    },
  );

  // Factura de UTE del cliente: se guarda (sin proyecto) y la IA saca los
  // datos. A diferencia del pedido para un proyecto, no se persiste nada en
  // ningún lado: los datos vuelven a la pantalla y se vuelcan al formulario.
  const FACTURA_MIME = ["image/jpeg", "image/png", "application/pdf", "image/heic", "image/heif"];
  const FACTURA_MAX = 10 * 1024 * 1024;
  app.post(
    "/ute-tramites-comerciales/contactos/:contactoId/ute-extract",
    { preHandler: puedeEnviar },
    async (request) => {
      const user = ensureUser(request);
      const { contactoId } = contactoParams.parse(request.params);
      const contacto = await contactoOTirar(contactoId);
      const filePart = await request.file();
      if (!filePart) throw badRequest("NO_FILE", "No se recibió ningún archivo en el campo 'file'");
      // HEIC también por extensión: hay navegadores que lo mandan como octet-stream.
      const heic = esHeic({ filename: filePart.filename, mimetype: filePart.mimetype });
      if (!heic && !FACTURA_MIME.includes(filePart.mimetype)) {
        throw badRequest(
          "FILE_TYPE_INVALID",
          `Formato no soportado (${filePart.mimetype}). Usá JPG, PNG, HEIC o PDF.`,
        );
      }
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of filePart.file) {
        total += chunk.length;
        if (total > FACTURA_MAX) throw badRequest("FILE_TOO_LARGE", "El archivo supera los 10MB permitidos.");
        chunks.push(Buffer.from(chunk));
      }
      const mime = heic ? "image/jpeg" : filePart.mimetype;
      const fileBuffer = heic ? await convertirHeicABufferJpeg(Buffer.concat(chunks)) : Buffer.concat(chunks);

      let extracted;
      try {
        extracted = await extractFromDocument({
          fileBuffer,
          mimeType: mime,
          tipo: "factura_ute",
          ctx: { userId: user.id, entityId: contactoId },
        });
      } catch (err) {
        throw badRequest(
          "AI_EXTRACTION_FAILED",
          `No se pudieron extraer datos del documento: ${(err as Error).message}`,
        );
      }

      // Una sola factura pendiente por contacto: la que se sube reemplaza a la
      // de un intento anterior que no se llegó a enviar.
      const pendientes = await prisma.fileAttachment.findMany({
        where: { projectId: null, toolSource: TOOL_SOURCE_FACTURA, toolEntityId: contactoId, deletedAt: null },
        select: { id: true, url: true },
      });
      const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
      const nombre = `Factura UTE - ${contacto.nombre}.${ext}`.replace(/[\\/:*?"<>|]/g, "-");
      const stored = await saveBufferAsAttachment(fileBuffer, nombre, mime, carpetaContacto(contactoId));
      const adjunto = await prisma.fileAttachment.create({
        data: {
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.OTRO,
          toolSource: TOOL_SOURCE_FACTURA,
          toolEntityId: contactoId,
          uploadedById: user.id,
        },
      });
      if (pendientes.length > 0) {
        await prisma.fileAttachment.updateMany({
          where: { id: { in: pendientes.map((p) => p.id) } },
          data: { deletedAt: new Date() },
        });
        await Promise.all(pendientes.map((p) => deleteStoredFile(p.url).catch(() => undefined)));
      }

      return { extraido: extracted.data, facturaAttachmentId: adjunto.id, filename: adjunto.filename };
    },
  );

  // Envío: igual que para un proyecto (mail desde la casilla del usuario con
  // el Excel adjunto), pero el trámite y los archivos quedan del contacto.
  app.post(
    "/ute-tramites-comerciales/contactos/:contactoId/suministro-individual/enviar",
    { preHandler: puedeEnviar },
    async (request) => {
      const user = ensureUser(request);
      const { contactoId } = contactoParams.parse(request.params);
      const contacto = await contactoOTirar(contactoId);
      const body = enviarContactoSchema.parse(request.body);
      const context = body.context as EmailTemplateContext;
      const esAumento = context.tecnica.esAumento;

      const buffer = await completarFormularioSuministro(datosFormularioDesdeContexto(context));
      const filename = nombreArchivoFormulario(contacto.nombre, esAumento);

      // Si el mail falla, tira: no se registra nada (ver la ruta del proyecto).
      // Sin projectId, `sendTemplatedEmail` no toca ninguna config de UTE.
      const resultado = await sendTemplatedEmail({
        userId: user.id,
        templateKey: SUMINISTRO_INDIVIDUAL_KEY,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        body: body.body,
        attachments: [{ filename, content: buffer, contentType: XLSX_MIME }],
      });

      let tramiteId: string | null = null;
      try {
        const { tramite } = await registrarTramiteEnviado({
          contactoId,
          tramiteFormulario: context.tecnica.tramite,
          potenciaContratada: context.tecnica.potenciaContratada,
          potenciaSolicitada: context.tecnica.potenciaSolicitada,
          emailLogId: resultado.id,
          userId: user.id,
        });
        tramiteId = tramite.id;
      } catch (err) {
        request.log.warn({ err }, "No se pudo registrar el trámite comercial enviado (contacto)");
      }

      // Copia del Excel, sin proyecto, enlazada al trámite. Al reenviar el
      // mismo trámite se reemplaza la anterior.
      try {
        const previos = tramiteId
          ? await prisma.fileAttachment.findMany({
              where: { projectId: null, toolSource: TOOL_SOURCE_FORMULARIO, toolEntityId: tramiteId, deletedAt: null },
              select: { id: true, url: true },
            })
          : [];
        const stored = await saveBufferAsAttachment(buffer, filename, XLSX_MIME, carpetaContacto(contactoId));
        const adjunto = await prisma.fileAttachment.create({
          data: {
            filename: stored.filename,
            storedFilename: stored.storedFilename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            url: stored.url,
            tipo: FileAttachmentTipo.OTRO,
            toolSource: TOOL_SOURCE_FORMULARIO,
            toolEntityId: tramiteId ?? resultado.id,
            uploadedById: user.id,
          },
        });
        if (tramiteId) {
          await prisma.uteTramiteComercial.update({
            where: { id: tramiteId },
            data: { fileAttachmentId: adjunto.id },
          });
        }
        if (previos.length > 0) {
          await prisma.fileAttachment.updateMany({
            where: { id: { in: previos.map((p) => p.id) } },
            data: { deletedAt: new Date() },
          });
          await Promise.all(previos.map((p) => deleteStoredFile(p.url).catch(() => undefined)));
        }
      } catch (err) {
        request.log.warn({ err }, "No se pudo guardar el formulario de UTE enviado (contacto)");
      }

      // La factura subida en la pantalla pasa a ser del trámite (reemplaza la
      // de un envío anterior del mismo trámite).
      if (tramiteId && body.facturaAttachmentId) {
        try {
          const factura = await prisma.fileAttachment.findFirst({
            where: {
              id: body.facturaAttachmentId,
              projectId: null,
              toolSource: TOOL_SOURCE_FACTURA,
              toolEntityId: { in: [contactoId, tramiteId] },
              deletedAt: null,
            },
            select: { id: true },
          });
          if (factura) {
            const viejas = await prisma.fileAttachment.findMany({
              where: {
                toolSource: TOOL_SOURCE_FACTURA,
                toolEntityId: tramiteId,
                deletedAt: null,
                id: { not: factura.id },
              },
              select: { id: true, url: true },
            });
            await prisma.fileAttachment.update({ where: { id: factura.id }, data: { toolEntityId: tramiteId } });
            if (viejas.length > 0) {
              await prisma.fileAttachment.updateMany({
                where: { id: { in: viejas.map((v) => v.id) } },
                data: { deletedAt: new Date() },
              });
              await Promise.all(viejas.map((v) => deleteStoredFile(v.url).catch(() => undefined)));
            }
          }
        } catch (err) {
          request.log.warn({ err }, "No se pudo enlazar la factura de UTE al trámite");
        }
      }

      await createAuditEntry({
        entityType: tramiteId ? AuditEntityType.ute_tramite_comercial : AuditEntityType.contacto,
        entityId: tramiteId ?? contactoId,
        userId: user.id,
        action: AuditAction.created,
        description: esAumento
          ? `Solicitó a UTE aumento de potencia a ${context.tecnica.potenciaSolicitada || "(sin especificar)"} kW para ${contacto.nombre} (sin proyecto)`
          : `Envió a UTE una solicitud de suministro individual para ${contacto.nombre} (sin proyecto)`,
        metadata: { kind: "ute_suministro_individual", contactoId, emailLogId: resultado.id, filename, tramiteId },
      });

      return { ok: true, emailLogId: resultado.id, filename, tramiteId };
    },
  );
}
