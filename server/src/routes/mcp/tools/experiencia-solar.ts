// Experiencia Solar: los clientes con la obra ya hecha.
//
// Va aparte de las herramientas de proyecto por una razón concreta: los
// "generadores livianos" —los que se cargaron por planilla, sin obra en el
// sistema— están excluidos de la lista de proyectos y solo se ven acá. Buscar
// un cliente entregado por `buscar_proyecto` no lo encontraría.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, InteractionChannel, InteractionDirection, InteractionReason, Module } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import {
  createInteraction,
  getClienteFicha,
  listClientes,
  type ClienteEstado,
} from "../../../services/clientes/index.js";
import { getDetalleGenerador } from "../../../services/reportesFv/panel.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { buildDownloadUrl } from "../descargas.routes.js";
import { campos, fechaCorta, fechaLarga, pesos, porcentaje, texto, usd } from "../format.js";

const TOPE = 15;

export function registerExperienciaSolarTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "buscar_generador",
    {
      title: "Buscar generador",
      description:
        "Busca en la cartera de Experiencia Solar: todos los clientes con instalación, " +
        "estén en obra o ya entregados. A diferencia de buscar_proyecto, incluye los " +
        "que se cargaron por planilla y no tienen obra en el sistema. Usar para " +
        "clientes ya instalados.",
      inputSchema: {
        busqueda: z.string().min(2).describe("Nombre, email o teléfono"),
        estado: z
          .enum(["ACTIVO", "FINALIZADO", "ARCHIVADO", "PROSPECTO"])
          .optional()
          .describe("Filtrar por estado. Por defecto trae activos y finalizados."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ busqueda, estado }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);

      const { items } = await listClientes(
        { search: busqueda, estado: estado as ClienteEstado | undefined },
        1,
        TOPE,
      );

      if (items.length === 0) {
        return texto(`No encontré generadores que coincidan con "${busqueda}".`);
      }

      const lista = items.map((c) => {
        const recorrido = c.etapa?.recorrido?.nombreCorto ?? null;
        const detalle = [
          c.estado,
          recorrido,
          c.potenciaKwp ? `${c.potenciaKwp} kWp` : null,
          c.departamento,
        ]
          .filter(Boolean)
          .join(" · ");
        return `- ${c.nombre} (id: ${c.projectId})\n  ${detalle}`;
      });

      return texto(
        `${items.length} generador${items.length > 1 ? "es" : ""} para "${busqueda}":`,
        lista.join("\n"),
      );
    },
  );

  server.registerTool(
    "ficha_generador",
    {
      title: "Ficha del generador",
      description:
        "Todo sobre un cliente con instalación: contacto, potencia, fecha de entrega, " +
        "en qué tramo del recorrido está, cuándo fue el último contacto, el trámite de " +
        "UTE y cuándo toca el próximo mantenimiento por aniversario.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);

      const f = await getClienteFicha(project_id);
      if (!f) return texto(`No encontré ningún generador con el id ${project_id}.`);

      const recorrido = f.etapa?.recorrido
        ? `${f.etapa.recorrido.nombreLargo}${f.etapa.pipeline?.label ? ` · ${f.etapa.pipeline.label}` : ""}`
        : null;

      const datos = campos([
        ["Estado", f.estado],
        ["Recorrido", recorrido],
        ["Potencia", f.potenciaKwp ? `${f.potenciaKwp} kWp` : null],
        ["Departamento", f.departamento],
        ["Dirección", f.direccion],
        ["Email", f.mail],
        ["Teléfono", f.telefono],
        ["Asesor", f.asesor?.nombre],
        ["Venta", f.fechaVenta],
        ["Entrega", f.fechaEntrega],
        ["Trámite UTE", f.tramiteUte ? `${f.tramiteUte.etapa}${f.tramiteUte.desde ? ` desde ${f.tramiteUte.desde}` : ""}` : null],
        ["Último contacto", f.ultimoContactoEn ? fechaCorta(f.ultimoContactoEn) : "sin registrar"],
        ["Tiene acceso al portal", f.hasPortalUser ? "sí" : "no"],
      ]);

      const mant = f.mantenimiento
        ? campos([
            ["Cumple", `${f.mantenimiento.aniosQueCumple} año${f.mantenimiento.aniosQueCumple === 1 ? "" : "s"}`],
            ["Próximo aniversario", f.mantenimiento.proximoAniversario],
            ["Faltan", `${f.mantenimiento.diasRestantes} días`],
          ])
        : null;

      const aviso = f.avisoHabilitacionPendiente
        ? "⚠️ La habilitación de UTE terminó y todavía no se le avisó al cliente que puede encender."
        : null;

      const ultimas =
        f.interacciones.length > 0
          ? "ÚLTIMOS CONTACTOS\n" +
            f.interacciones
              .slice(0, 5)
              .map((i) => `- ${fechaCorta(i.createdAt)} · ${i.channel}: ${i.content}`)
              .join("\n")
          : null;

      return texto(
        f.nombre,
        datos,
        aviso,
        mant ? `MANTENIMIENTO\n${mant}` : null,
        ultimas,
      );
    },
  );

  server.registerTool(
    "reporte_fv",
    {
      title: "Reporte fotovoltaico del generador",
      description:
        "El último reporte mensual de generación de un cliente: cuánto generó, cuánto " +
        "consumió, cuánto exportó, cuánto ahorró y cómo viene el retorno de la " +
        "inversión, con enlace al PDF. Usar cuando preguntan cómo viene generando una " +
        "instalación.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);

      const d = await getDetalleGenerador(project_id);
      if (!d) return texto(`No encontré ningún generador con el id ${project_id}.`);

      const detalle = d as unknown as {
        clientName?: string;
        emisiones?: Array<{
          id: string;
          periodo: string | Date;
          version: number;
          estado: string;
          fileAttachmentId: string | null;
          enviadoEn: Date | null;
        }>;
        lecturas?: Array<Record<string, unknown>>;
        config?: unknown;
      };

      const nombre = detalle.clientName ?? "el generador";
      const emisiones = detalle.emisiones ?? [];

      if (emisiones.length === 0) {
        return texto(
          `${nombre} todavía no tiene reportes emitidos. ` +
            `Los reportes se preparan y envían desde Experiencia Solar → Reportes FV.`,
        );
      }

      const ultima = emisiones[0];
      const enlace = ultima.fileAttachmentId
        ? buildDownloadUrl(user.id, "project-file", ultima.fileAttachmentId)
        : null;

      // Los números del período salen de la fila del panel, que es donde el
      // motor deja el cálculo ya resuelto.
      // El período se guarda como fecha (el día 1 del mes), no como "2026-07":
      // el detalle lo devuelve ya formateado y hay que volver a convertirlo.
      const periodoDate =
        ultima.periodo instanceof Date
          ? ultima.periodo
          : new Date(`${String(ultima.periodo).slice(0, 7)}-01T00:00:00.000Z`);

      const fila = await prisma.reporteFvCalculo.findFirst({
        where: { projectId: project_id, periodo: periodoDate },
        select: {
          autoconsumoKwh: true,
          importacionRedKwh: true,
          exportacionMesAnteriorKwh: true,
          ahorroTotal: true,
          ahorroTotalUsd: true,
          retornoInversionPct: true,
        },
      });

      const numeros = fila
        ? campos([
            ["Autoconsumo", `${Math.round(Number(fila.autoconsumoKwh))} kWh`],
            ["Tomado de la red", `${Math.round(Number(fila.importacionRedKwh))} kWh`],
            ["Exportado", `${Math.round(Number(fila.exportacionMesAnteriorKwh))} kWh`],
            ["Ahorro del mes", pesos(Number(fila.ahorroTotal))],
            ["Ahorro en dólares", usd(Number(fila.ahorroTotalUsd))],
            ["Retorno de la inversión", porcentaje(Number(fila.retornoInversionPct) / 100, 1)],
          ])
        : null;

      const historial = emisiones
        .slice(0, 6)
        .map(
          (e) =>
            `- ${String(e.periodo instanceof Date ? e.periodo.toISOString() : e.periodo).slice(0, 7)} v${e.version} · ${e.estado}` +
            (e.enviadoEn ? ` · enviado ${fechaCorta(e.enviadoEn)}` : ""),
        )
        .join("\n");

      return texto(
        `Reporte de ${nombre} — período ${String(ultima.periodo instanceof Date ? ultima.periodo.toISOString() : ultima.periodo).slice(0, 7)}`,
        numeros,
        enlace ? `PDF (el enlace vence en 15 minutos):\n${enlace}` : "Ese reporte todavía no tiene PDF generado.",
        emisiones.length > 1 ? `HISTORIAL\n${historial}` : null,
      );
    },
  );

  server.registerTool(
    "registrar_interaccion",
    {
      title: "Registrar un contacto con el cliente",
      description:
        "Anota en la ficha del cliente una llamada, un WhatsApp, un mail o una visita. " +
        "Es lo que alimenta el 'último contacto' y el historial. Usar después de hablar " +
        "con un cliente ya instalado.",
      inputSchema: {
        project_id: z.string().min(1),
        canal: z.enum(["WHATSAPP", "EMAIL", "LLAMADA", "VISITA", "OTRO"]),
        contenido: z.string().min(1).describe("Qué se habló"),
        direccion: z
          .enum(["ENTRANTE", "SALIENTE"])
          .optional()
          .describe("ENTRANTE si llamó el cliente, SALIENTE si lo llamamos"),
        motivo: z
          .enum(["BIENVENIDA", "SEGUIMIENTO", "AVISO_HABILITACION", "CONSULTA", "OTRO"])
          .optional()
          .describe("AVISO_HABILITACION marca que se le avisó que puede encender"),
      },
    },
    async ({ project_id, canal, contenido, direccion, motivo }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.CREATE);

      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: { clientName: true },
      });
      if (!p) return texto(`No encontré ningún generador con el id ${project_id}.`);

      await createInteraction(project_id, canal as InteractionChannel, contenido, user.id, {
        direction: direccion as InteractionDirection | undefined,
        reason: motivo as InteractionReason | undefined,
      });

      const extra =
        motivo === "AVISO_HABILITACION"
          ? " Queda registrado que se le avisó que puede encender, así que dejan de salir los recordatorios."
          : "";

      return texto(`Registrado el contacto con ${p.clientName} por ${canal.toLowerCase()}.${extra}`);
    },
  );
}
