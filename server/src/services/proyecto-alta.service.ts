// Alta de proyectos: convertir un lead ganado y crear uno desde cero.
//
// Lo comparten la API HTTP (el modal de la pantalla) y el conector MCP, para que
// la obra nazca igual entre por donde entre: mismo pipeline, mismo trámite UTE,
// mismos adjuntos copiados del lead y la misma auditoría.

import {
  AuditAction,
  AuditEntityType,
  ModalidadPago,
  Prisma,
  ProjectStatus,
  SalesStage,
  UteStage,
  UteStatus,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { createAuditEntry } from "./audit.service.js";
import { emitirHecho } from "./avisos/emitir.js";
import { resolverVinculo } from "./crm/contactos.service.js";
import { applyDeadlineRulesToProject } from "./deadline.service.js";
import { datosFacturacion, type Facturacion } from "./finance/a-facturar.service.js";
import { planFinanciacionBancaria } from "./planPagos.service.js";
import { createInitialPipeline, generateProjectCode } from "./project.service.js";
import { copyLatestProposalToProject, getLatestPublishedQuote } from "./proposal/latest-proposal.service.js";
import { copyLeadAttachmentsToProject, moveLeadMediaToProject } from "./sales/sales.service.js";
import { crearSuministrosDesdePropuesta } from "./suministros.service.js";
import { regenerateUteSubstages } from "./ute-sync.service.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { addDays, parseDateOnly, todayUtc } from "../utils/dates.js";
import { decimalToNumber } from "../utils/serialization.js";

/** Lo mínimo de un logger que usan estas funciones (el de Fastify o console). */
export interface AltaLog {
  error: (obj: unknown, msg: string) => void;
}

const consoleLog: AltaLog = { error: (obj, msg) => console.error(msg, obj) };

/** Metadata de auditoría opcional (el conector marca `source: "mcp"`). */
type AuditMeta = Prisma.InputJsonValue | undefined;

/** Crea el trámite UTE vacío del proyecto con sus subetapas de sistema. */
async function crearTramiteUte(projectId: string, userId: string) {
  const proc = await prisma.uteProcess.create({
    data: {
      projectId,
      currentStage: UteStage.CONSULTA,
      currentStatus: UteStatus.PENDIENTE,
      createdById: userId,
    },
  });
  await regenerateUteSubstages(prisma, proc);
}

// ─── Convertir un lead ganado ─────────────────────────────────────────────

/**
 * Cómo quedaría el proyecto al convertir: el lead validado (existe, está
 * ganado y no se convirtió) y los datos mezclados, con de dónde salieron
 * potencia y monto y qué falta. No escribe nada: lo usa la conversión y la
 * vista previa del conector.
 */
export async function datosConversion(leadId: string, body: ConvertirLeadInput) {
  const lead = await prisma.salesLead.findFirst({
    where: { id: leadId, deletedAt: null },
  });

  if (!lead) {
    throw notFound("LEAD_NOT_FOUND", "Lead no encontrado");
  }

  if (lead.stage !== SalesStage.CERRADO_GANADO) {
    throw badRequest("LEAD_NOT_WIN", "El lead debe estar en CERRADO_GANADO para convertirse");
  }

  if (lead.convertedToProjectId) {
    throw conflict("ALREADY_CONVERTED", "El lead ya fue convertido a proyecto");
  }

  // Merge: body tiene prioridad sobre lo del lead. Si después de mezclar
  // todavía faltan los obligatorios, la conversión devuelve un 400 claro.
  const clientName = body.clientName?.trim() || lead.clientName;
  const clientAddress = body.clientAddress ?? lead.address ?? null;
  const clientEmail = body.clientEmail ?? lead.clientEmail ?? null;
  const clientPhone = body.clientPhone ?? lead.clientPhone ?? null;
  // Cotización y potencia: prioridad body (lo que el usuario editó en el modal)
  // > última propuesta publicada > estimado grueso del lead.
  const quote = await getLatestPublishedQuote(lead.id);
  const estKwp = lead.estimatedKwp ? decimalToNumber(lead.estimatedKwp) ?? 0 : 0;
  const estBudget = lead.estimatedBudgetUsd ? decimalToNumber(lead.estimatedBudgetUsd) ?? 0 : 0;
  const capacityKwp = body.capacityKwp ?? quote?.potenciaKwp ?? estKwp;
  const budgetUsd = body.budgetUsd ?? quote?.precioUsd ?? estBudget;
  const fuente = (pedido: unknown, dePropuesta: unknown): Fuente =>
    pedido != null ? "pedido" : dePropuesta != null ? "propuesta" : "estimado";
  const locationCity = body.locationCity?.trim() ?? "";
  const locationProvince = body.locationProvince?.trim() ?? "";

  const missing: string[] = [];
  if (!clientName) missing.push("nombre del cliente");
  if (!locationCity) missing.push("ciudad");
  if (!locationProvince) missing.push("provincia");
  if (!capacityKwp || capacityKwp <= 0) missing.push("potencia (kWp)");
  if (!body.facturacion) missing.push("qué se le factura al cliente");

  return {
    lead,
    clientName,
    clientAddress,
    clientEmail,
    clientPhone,
    capacityKwp,
    budgetUsd,
    fuenteKwp: fuente(body.capacityKwp, quote?.potenciaKwp),
    fuenteMonto: fuente(body.budgetUsd, quote?.precioUsd),
    locationCity,
    locationProvince,
    missing,
  };
}

/** De dónde salió un dato de la conversión. */
export type Fuente = "pedido" | "propuesta" | "estimado";

export interface ConvertirLeadInput {
  clientName?: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  capacityKwp?: number;
  locationCity?: string;
  locationProvince?: string;
  budgetUsd?: number | null;
  plannedEndDate?: string | null;
  startDate?: string;
  modalidadPago?: ModalidadPago | null;
  facturacion?: Facturacion;
}

/**
 * Convierte un lead en CERRADO_GANADO en proyecto. Lo que no viene en `body`
 * sale del lead; potencia y monto, de la última propuesta publicada y si no
 * hay, del estimado del lead. Ciudad, departamento y qué se factura son
 * obligatorios. Devuelve el proyecto creado.
 */
export async function convertirLeadAProyecto(params: {
  leadId: string;
  body: ConvertirLeadInput;
  userId: string;
  log?: AltaLog;
  auditMetadata?: AuditMeta;
}) {
  const { leadId, body, userId, auditMetadata } = params;
  const log = params.log ?? consoleLog;

  const datos = await datosConversion(leadId, body);
  const { lead, clientName, clientAddress, clientEmail, clientPhone, locationCity, locationProvince } = datos;
  const capacityKwpFinal = datos.capacityKwp;
  const budgetUsdFinal = datos.budgetUsd;
  if (datos.missing.length > 0) {
    throw badRequest(
      "MISSING_PROJECT_FIELDS",
      `Faltan datos para crear el proyecto: ${datos.missing.join(", ")}.`,
    );
  }

  const startDate = body.startDate ? parseDateOnly(body.startDate) : todayUtc();
  const plannedEndDate = body.plannedEndDate
    ? parseDateOnly(body.plannedEndDate)
    : (() => {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + 90);
        return d;
      })();
  const estimatedMwhYear = capacityKwpFinal * 1.45;
  const code = await generateProjectCode();

  const project = await prisma.project.create({
    data: {
      code,
      clientName,
      capacityKwp: new Prisma.Decimal(capacityKwpFinal),
      locationCity,
      locationProvince,
      clientAddress,
      status: ProjectStatus.ACTIVE,
      startDate,
      // Fecha de venta = momento en que se cerró el lead como ganado (Tanda 3).
      saleDate: lead.closedAt ?? null,
      plannedEndDate,
      budgetUsd: new Prisma.Decimal(budgetUsdFinal),
      executedUsd: new Prisma.Decimal(0),
      estimatedMwhYear: new Prisma.Decimal(estimatedMwhYear.toFixed(2)),
      co2TonsAvoided: new Prisma.Decimal((estimatedMwhYear * 0.5).toFixed(2)),
      clientEmail: (body.clientEmail ?? clientEmail ?? "") || "",
      clientPhone: (body.clientPhone ?? clientPhone ?? "") || "",
      modalidadPago: body.modalidadPago ?? null,
      ...(body.facturacion ? datosFacturacion(body.facturacion) : {}),
      salespersonId: lead.assignedToId ?? null,
      // CRM: el proyecto es del mismo contacto y empresa que el lead.
      contactoId: lead.contactoId ?? null,
      empresaId: lead.empresaId ?? null,
      createdById: userId,
    },
  });

  await createInitialPipeline(project.id, startDate, plannedEndDate, null);
  await crearTramiteUte(project.id, userId);

  // Propuesta con más de un inversor: un sistema por inversor, cada uno su
  // suministro con su trámite UTE. No falla la conversión si algo sale mal.
  try {
    const creados = await crearSuministrosDesdePropuesta(project.id, lead.id, userId);
    if (creados) {
      await createAuditEntry({
        entityType: AuditEntityType.project,
        entityId: project.id,
        projectId: project.id,
        userId,
        action: AuditAction.created,
        description: `Creó un suministro por inversor desde la propuesta: ${creados}`,
      });
    }
  } catch (err) {
    log.error({ err, projectId: project.id }, "No se pudieron crear los suministros desde la propuesta");
  }

  await prisma.salesLead.update({
    where: { id: lead.id },
    data: {
      convertedToProjectId: project.id,
      convertedAt: new Date(),
    },
  });

  await prisma.salesActivity.create({
    data: {
      leadId: lead.id,
      userId,
      fromStage: lead.stage,
      toStage: lead.stage,
      action: "lead_converted",
      notes: `Lead convertido a proyecto ${code}`,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.lead,
    entityId: lead.id,
    projectId: project.id,
    userId,
    action: AuditAction.lead_converted,
    description: `Convirtió lead '${lead.clientName}' al proyecto ${code}`,
    metadata: auditMetadata,
  });

  await createAuditEntry({
    entityType: AuditEntityType.project,
    entityId: project.id,
    projectId: project.id,
    userId,
    action: AuditAction.created,
    description: `Creó proyecto '${project.clientName}' desde lead ${lead.code}`,
    metadata: auditMetadata,
  });
  emitirHecho({ disparador: "proyecto.creado", projectId: project.id });
  // El usuario del portal se crea solo con la venta, si el cliente tiene mail:
  // el aviso de acceso al portal lo necesita (y si no, lo crea al salir).
  {
    const { asegurarUsuarioPortal } = await import("./clientes/portal-user.service.js");
    const r = await asegurarUsuarioPortal(project.id, userId);
    if (!r.ok) console.log(`[portal] ${project.code} sin usuario del portal: ${r.motivo}`);
  }

  // Copia de adjuntos del lead al proyecto. No falla la conversión si la
  // copia falla parcialmente (preferimos tener el proyecto creado).
  try {
    const { copied } = await prisma.$transaction((tx) =>
      copyLeadAttachmentsToProject(tx, lead.id, project.id, userId),
    );
    if (copied > 0) {
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: project.id,
        projectId: project.id,
        userId,
        action: AuditAction.file_uploaded,
        description: `Copió ${copied} adjunto${copied === 1 ? "" : "s"} del lead al proyecto`,
      });
    }
  } catch (err) {
    log.error({ err, leadId: lead.id, projectId: project.id }, "copy lead attachments failed");
  }

  // Fotos y videos de la visita de ventas: van aparte porque cada uno tiene
  // que quedar donde el proyecto lo muestra (galería de obra / sección
  // Videos), no sueltos entre los documentos. Mismo criterio que arriba: si
  // falla, el proyecto ya está creado y eso es lo que importa.
  try {
    const { fotos, videos } = await prisma.$transaction((tx) =>
      moveLeadMediaToProject(tx, lead.id, project.id, userId),
    );
    if (fotos > 0 || videos > 0) {
      const partes = [
        fotos > 0 ? `${fotos} foto${fotos === 1 ? "" : "s"}` : null,
        videos > 0 ? `${videos} video${videos === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: project.id,
        projectId: project.id,
        userId,
        action: AuditAction.file_uploaded,
        description: `Pasó ${partes.join(" y ")} de la visita de ventas al proyecto`,
      });
    }
  } catch (err) {
    log.error({ err, leadId: lead.id, projectId: project.id }, "move lead media failed");
  }

  // El pago al instalador ya NO se crea al ganar: lo crea el calendario al
  // agendar la obra con un equipo tercerizado (syncInstallerPaymentForProject).
  // Crearlo acá dejaba "sin asignar" también las obras de equipo propio.

  // Copia la propuesta comercial (última versión publicada) como adjunto del
  // proyecto. La v2 guarda los PDF sueltos en disco (sin FileAttachment), por
  // eso no la agarra copyLeadAttachmentsToProject. Best-effort igual que arriba.
  try {
    const { copied } = await copyLatestProposalToProject(lead.id, project.id, userId);
    if (copied > 0) {
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: project.id,
        projectId: project.id,
        userId,
        action: AuditAction.file_uploaded,
        description: `Copió la propuesta comercial del lead al proyecto (${copied} PDF)`,
      });
    }
  } catch (err) {
    log.error({ err, leadId: lead.id, projectId: project.id }, "copy lead proposal failed");
  }

  // Vincula los comentarios del lead al proyecto (relink: preserva autor y
  // fecha; el leadId se conserva, así quedan visibles en el lead y el proyecto).
  try {
    const { count } = await prisma.comment.updateMany({
      where: { leadId: lead.id, projectId: null, deletedAt: null },
      data: { projectId: project.id },
    });
    if (count > 0) {
      await createAuditEntry({
        entityType: AuditEntityType.project,
        entityId: project.id,
        projectId: project.id,
        userId,
        action: AuditAction.comment_added,
        description: `Vinculó ${count} comentario${count === 1 ? "" : "s"} del lead al proyecto`,
      });
    }
  } catch (err) {
    log.error({ err, leadId: lead.id, projectId: project.id }, "relink lead comments failed");
  }

  // Ganado con financiación bancaria: la cuota única del banco queda prevista.
  if (body.modalidadPago === "FINANCIACION_BANCARIA") {
    await planFinanciacionBancaria(project.id, userId).catch((err) =>
      log.error({ err, projectId: project.id }, "plan financiación bancaria failed"),
    );
  }

  return project;
}

// ─── Crear un proyecto desde cero (sin lead) ──────────────────────────────

export interface CrearProyectoInput {
  clientName: string;
  capacityKwp: number;
  locationCity: string;
  locationProvince: string;
  plannedEndDate?: string | null;
  budgetUsd?: number | null;
  estimatedMwhYear?: number | null;
  salespersonId?: string;
  modalidadPago?: ModalidadPago;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  startDate?: string;
  saleDate?: string;
  llevaFactura?: boolean;
  facturaNota?: string | null;
  facturacion?: Facturacion;
  /** Datos del primer sistema ya normalizados para Prisma (los arma la ruta). */
  solarSystem?: Record<string, unknown> & { order?: number };
}

/** Crea un proyecto cargado a mano, sin lead. Devuelve el proyecto creado. */
export async function crearProyectoDesdeCero(params: {
  body: CrearProyectoInput;
  userId: string;
  auditMetadata?: AuditMeta;
}) {
  const { body, userId, auditMetadata } = params;
  const startDate = body.startDate ? parseDateOnly(body.startDate) : todayUtc();
  // saleDate por defecto: hoy (fecha de creación del proyecto). Editable
  // después desde el detalle del proyecto.
  const saleDate = body.saleDate ? parseDateOnly(body.saleDate) : todayUtc();
  // plannedEndDate es opcional. Para armar el pipeline inicial si no viene,
  // asumimos 90 días desde el inicio como placeholder (no se muestra en UI).
  const plannedEndDate = body.plannedEndDate
    ? parseDateOnly(body.plannedEndDate)
    : addDays(startDate, 90);

  const code = await generateProjectCode();
  // CRM: un proyecto cargado a mano (sin lead) también queda con su contacto.
  const vinculo = await resolverVinculo(
    { nombre: body.clientName, telefono: body.clientPhone, email: body.clientEmail },
    userId,
  );

  const { order: systemOrder, ...systemData } = body.solarSystem ?? {};

  const project = await prisma.project.create({
    data: {
      code,
      ...vinculo,
      clientName: body.clientName,
      capacityKwp: new Prisma.Decimal(body.capacityKwp),
      locationCity: body.locationCity,
      locationProvince: body.locationProvince,
      status: ProjectStatus.ACTIVE,
      startDate,
      saleDate,
      plannedEndDate: body.plannedEndDate ? plannedEndDate : null,
      budgetUsd: body.budgetUsd != null ? new Prisma.Decimal(body.budgetUsd) : null,
      executedUsd: new Prisma.Decimal(0),
      estimatedMwhYear: body.estimatedMwhYear != null ? new Prisma.Decimal(body.estimatedMwhYear) : null,
      co2TonsAvoided: body.estimatedMwhYear != null
        ? new Prisma.Decimal((body.estimatedMwhYear * 0.5).toFixed(2))
        : null,
      modalidadPago: body.modalidadPago ?? null,
      clientEmail: body.clientEmail || null,
      clientPhone: body.clientPhone || null,
      clientAddress: body.clientAddress || null,
      salespersonId: body.salespersonId ?? null,
      ...(body.facturacion
        ? datosFacturacion(body.facturacion)
        : { llevaFactura: body.llevaFactura ?? false, facturaNota: body.facturaNota || null }),
      createdById: userId,
      ...(body.solarSystem
        ? {
            solarSystems: {
              create: {
                order: systemOrder ?? 1,
                ...systemData,
              },
            },
          }
        : {}),
    },
  });

  await createInitialPipeline(project.id, startDate, plannedEndDate, body.modalidadPago ?? null);

  // Aplicar reglas de deadline al pipeline recién creado (G.2). Es un proyecto
  // nuevo, no tiene overrides manuales todavía, así que recalcula todo.
  const deadlineResult = await applyDeadlineRulesToProject(project.id);
  if (deadlineResult.updated > 0 || deadlineResult.cleared > 0) {
    await createAuditEntry({
      entityType: AuditEntityType.project,
      entityId: project.id,
      projectId: project.id,
      userId,
      action: AuditAction.updated,
      description: `Deadlines calculados automáticamente (${deadlineResult.updated} subetapas con deadline)`,
    });
  }

  // Genera las subetapas system bajo HABILITACION_UTE.
  await crearTramiteUte(project.id, userId);

  await createAuditEntry({
    entityType: AuditEntityType.project,
    entityId: project.id,
    projectId: project.id,
    userId,
    action: AuditAction.created,
    description: `Creó proyecto '${project.clientName}' con código ${project.code}`,
    metadata: auditMetadata ?? { stageCount: 5 },
  });

  return project;
}
