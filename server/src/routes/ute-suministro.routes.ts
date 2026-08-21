// Solicitud de suministro individual / aumento de potencia contratada a UTE.
//
// Es un trámite OPCIONAL que se dispara desde la subetapa "Consulta inicial
// UTE" de Onboarding: se manda un mail a UTE con el formulario oficial (un
// libro Excel) completado y adjunto.
//
// Los datos NO se leen de la base en el momento del envío: vienen en el pedido,
// porque el asesor los revisa y corrige en la pantalla antes de mandar. Eso
// garantiza que el adjunto diga exactamente lo mismo que el asesor vio.

import { Action, AuditAction, AuditEntityType, FileAttachmentTipo, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeAny } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { deleteStoredFile, saveBufferAsAttachment } from "../services/file-storage.service.js";
import { sendTemplatedEmail } from "../services/email/send.service.js";
import { SUMINISTRO_INDIVIDUAL_KEY } from "../services/email/seed-templates.js";
import type { EmailTemplateContext } from "../services/email/context.service.js";
import { datosFormularioDesdeContexto } from "../services/ute-suministro/mapping.js";
import {
  completarFormularioSuministro,
  nombreArchivoFormulario,
} from "../services/ute-suministro/xlsx.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { notFound, unauthorized } from "../utils/errors.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TOOL_SOURCE = "ute-suministro-individual";

// Los dos roles que hacen este trámite tienen permisos complementarios:
// ASESOR_COMERCIAL edita Onboarding pero solo mira Trámites UTE, y el rol
// TRAMITACION_UTE es al revés. Pedir un solo módulo dejaría a uno afuera.
const puedeVer = authorizeAny([
  { module: Module.ONBOARDING, action: Action.VIEW },
  { module: Module.TRAMITES_UTE, action: Action.VIEW },
]);
const puedeEnviar = authorizeAny([
  { module: Module.ONBOARDING, action: Action.EDIT },
  { module: Module.TRAMITES_UTE, action: Action.EDIT },
]);

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

// El contexto llega completo desde la pantalla. Se valida entero (no parcial)
// para que un campo renombrado en el cliente falle acá y no salga un formulario
// con un dato en blanco sin que nadie se entere.
const textos = z.string();
const contextSchema = z
  .object({
    cliente: z
      .object({
        nombre: textos,
        ci: textos,
        telefono: textos,
        email: textos,
        esEmpresa: z.boolean(),
        documento: textos,
      })
      .strict(),
    suministro: z
      .object({
        departamento: textos,
        localidad: textos,
        calle: textos,
        numero: textos,
        cuenta: textos,
        padron: textos,
        duplicador: textos,
        apartamento: textos,
        avisoAcceso: textos,
        notificaciones: textos,
        notifCalle: textos,
        notifNumero: textos,
        notifDuplicador: textos,
        notifApartamento: textos,
        notifDepartamento: textos,
        notifLocalidad: textos,
      })
      .strict(),
    tecnica: z
      .object({
        tension: textos,
        potenciaGenerador: textos,
        potenciaContratada: textos,
        tarifa: textos,
        acometida: textos,
        destino: textos,
        pasaLinea: textos,
        certificadoCarga: textos,
        cargaPerturbadora: textos,
        tensionNivel: textos,
        tipoSolicitud: textos,
        tramite: textos,
        tramiteAsociado: textos,
        requerimiento: textos,
        tipoMedida: textos,
        actividad: textos,
        potenciaSolicitada: textos,
        fases: textos,
        dobleContratacion: textos,
        potenciaPunta: textos,
        instaladaCalefaccion: textos,
        observaciones: textos,
        esAumento: z.boolean(),
      })
      .strict(),
    firma: z
      .object({ nombre: textos, cargo: textos, telefono: textos, email: textos })
      .strict(),
  })
  .strict();

const paramsSchema = z.object({ projectId: z.string().min(1) });

const enviarSchema = z
  .object({
    to: z.string().trim().min(1),
    cc: z.string().trim().optional(),
    bcc: z.string().trim().optional(),
    subject: z.string().trim().min(1),
    body: z.string().min(1),
    context: contextSchema,
  })
  .strict();

async function proyectoOTirar(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, clientName: true, code: true },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  return project;
}

export async function registerUteSuministroRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Estado del trámite, para que el botón de Onboarding pueda decir si ya se
  // pidió y por cuánto en vez de invitar a mandarlo de nuevo. Va acá y no en el
  // endpoint de config de documentos UTE porque aquel exige permiso de
  // INGENIERIA, que el asesor comercial no tiene.
  app.get(
    "/projects/:projectId/suministro-individual/estado",
    { preHandler: puedeVer },
    async (request) => {
      const { projectId } = paramsSchema.parse(request.params);
      await proyectoOTirar(projectId);
      const config = await prisma.uteDocumentConfig.findUnique({
        where: { projectId },
        select: { aumentoPotenciaSentAt: true, potSolicitada: true, potContratada: true },
      });
      return {
        solicitadoEl: config?.aumentoPotenciaSentAt ?? null,
        potenciaSolicitada: config?.potSolicitada ?? "",
        potenciaContratada: config?.potContratada ?? "",
      };
    },
  );

  // Vista previa del formulario completado, para revisarlo ANTES de mandarlo.
  // Es un POST porque el contexto (con las ediciones del asesor) va en el
  // cuerpo: son demasiados campos para una query string, y varios son datos
  // personales que no deben terminar en la URL ni en los logs de acceso.
  app.post(
    "/projects/:projectId/suministro-individual/preview.xlsx",
    { preHandler: puedeVer },
    async (request, reply) => {
      const { projectId } = paramsSchema.parse(request.params);
      const project = await proyectoOTirar(projectId);
      const context = contextSchema.parse(
        (request.body as { context?: unknown } | undefined)?.context,
      ) as EmailTemplateContext;

      const buffer = await completarFormularioSuministro(
        datosFormularioDesdeContexto(context),
      );
      const filename = nombreArchivoFormulario(project.clientName, context.tecnica.esAumento);

      reply
        .header("Content-Type", XLSX_MIME)
        .header("Content-Disposition", contentDisposition("attachment", filename))
        .send(buffer);
    },
  );

  // Envío: completa el formulario, lo manda adjunto desde la casilla del
  // usuario, lo guarda en los documentos del proyecto y deja la fecha del
  // trámite registrada.
  app.post(
    "/projects/:projectId/suministro-individual/enviar",
    { preHandler: puedeEnviar },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = paramsSchema.parse(request.params);
      const project = await proyectoOTirar(projectId);
      const body = enviarSchema.parse(request.body);
      const context = body.context as EmailTemplateContext;
      const esAumento = context.tecnica.esAumento;

      const buffer = await completarFormularioSuministro(
        datosFormularioDesdeContexto(context),
      );
      const filename = nombreArchivoFormulario(project.clientName, esAumento);

      // Si el mail falla, `sendTemplatedEmail` tira: no se guarda el archivo ni
      // se marca el trámite como pedido. Es a propósito — lo contrario dejaría
      // el proyecto diciendo que se solicitó algo que nunca salió.
      const resultado = await sendTemplatedEmail({
        userId: user.id,
        templateKey: SUMINISTRO_INDIVIDUAL_KEY,
        projectId,
        to: body.to,
        cc: body.cc,
        bcc: body.bcc,
        subject: body.subject,
        body: body.body,
        potenciaSolicitada: esAumento ? context.tecnica.potenciaSolicitada : undefined,
        attachments: [{ filename, content: buffer, contentType: XLSX_MIME }],
      });

      // Copia de lo que se mandó, en los documentos del proyecto. Una sola
      // versión vigente: al reenviar se reemplaza. Si falla, no se cae el
      // envío — el mail ya salió.
      try {
        const previos = await prisma.fileAttachment.findMany({
          where: { projectId, toolSource: TOOL_SOURCE, deletedAt: null },
          select: { id: true, url: true },
        });
        const stored = await saveBufferAsAttachment(buffer, filename, XLSX_MIME, projectId);
        await prisma.fileAttachment.create({
          data: {
            projectId,
            filename: stored.filename,
            storedFilename: stored.storedFilename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            url: stored.url,
            tipo: FileAttachmentTipo.OTRO,
            toolSource: TOOL_SOURCE,
            toolEntityId: resultado.id,
            uploadedById: user.id,
          },
        });
        if (previos.length > 0) {
          await prisma.fileAttachment.updateMany({
            where: { id: { in: previos.map((p) => p.id) } },
            data: { deletedAt: new Date() },
          });
          await Promise.all(previos.map((p) => deleteStoredFile(p.url).catch(() => undefined)));
        }
      } catch (err) {
        request.log.warn({ err }, "No se pudo guardar el formulario de UTE enviado");
      }

      await createAuditEntry({
        entityType: AuditEntityType.project,
        entityId: projectId,
        projectId,
        userId: user.id,
        action: AuditAction.created,
        description: esAumento
          ? `Solicitó a UTE aumento de potencia a ${context.tecnica.potenciaSolicitada || "(sin especificar)"} kW`
          : "Envió a UTE una solicitud de suministro individual",
        metadata: { kind: "ute_suministro_individual", emailLogId: resultado.id, filename },
      });

      return { ok: true, emailLogId: resultado.id, filename };
    },
  );
}
