// Registro de problemas técnicos resueltos: lo que el 12-nov-2026 se aprendió
// con Diego González (un SDM630 en 3P4 en red sin neutro daba el 401 de
// Growatt) no tenía dónde quedar para la próxima conversación.
//
// Lo cargan las conversaciones mismas, sin que nadie lo pida, cuando un
// problema queda resuelto; y lo consultan antes de diagnosticar. Está abierto a
// todo usuario del conector, sin pasar por la matriz de permisos: es
// conocimiento técnico común, no datos de un módulo.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuditAction, AuditEntityType, type Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { createAuditEntry } from "../../../services/audit.service.js";
import { diaUruguayIso } from "../../../utils/uruguay.js";
import type { McpUser } from "../context.js";
import { campos, fechaCorta, texto } from "../format.js";

const SELECT = {
  id: true,
  fecha: true,
  titulo: true,
  cliente: true,
  equipos: true,
  etiquetas: true,
  sintoma: true,
  descartado: true,
  causa: true,
  solucion: true,
  leccion: true,
  project: { select: { code: true, clientName: true } },
  creadoPor: { select: { name: true } },
} satisfies Prisma.CasoTecnicoSelect;

type Caso = Prisma.CasoTecnicoGetPayload<{ select: typeof SELECT }>;

function formatear(c: Caso): string {
  const quien = c.project ? `${c.project.clientName} (${c.project.code})` : c.cliente;
  return [
    `### ${fechaCorta(c.fecha)} · ${c.titulo}`,
    campos([
      ["Id", c.id],
      ["Cliente u obra", quien],
      ["Equipos", c.equipos],
      ["Síntoma", c.sintoma],
      ["Qué se revisó o descartó", c.descartado],
      ["Causa", c.causa],
      ["Solución", c.solucion],
      ["Lección", c.leccion],
      ["Etiquetas", c.etiquetas.join(", ")],
      ["Cargado por", c.creadoPor?.name],
    ]),
  ].join("\n");
}

/** Cada palabra tiene que aparecer en algún campo (o ser una etiqueta). */
function filtroBusqueda(busqueda: string): Prisma.CasoTecnicoWhereInput[] {
  const palabras = busqueda.trim().split(/\s+/).filter((p) => p.length >= 2).slice(0, 8);
  return palabras.map((p) => ({
    OR: [
      { titulo: { contains: p, mode: "insensitive" } },
      { cliente: { contains: p, mode: "insensitive" } },
      { equipos: { contains: p, mode: "insensitive" } },
      { sintoma: { contains: p, mode: "insensitive" } },
      { descartado: { contains: p, mode: "insensitive" } },
      { causa: { contains: p, mode: "insensitive" } },
      { solucion: { contains: p, mode: "insensitive" } },
      { leccion: { contains: p, mode: "insensitive" } },
      { etiquetas: { has: p } },
      { project: { clientName: { contains: p, mode: "insensitive" } } },
    ],
  }));
}

const campoTexto = (max: number) => z.string().trim().min(3).max(max);

export function registerCasosTecnicosTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "buscar_casos_tecnicos",
    {
      title: "Buscar problemas técnicos ya resueltos",
      description:
        "Registro de problemas técnicos de obra y de planta que Voltia ya resolvió: equipos (marca, modelo, " +
        "serie), síntoma, qué se descartó, causa, solución y lección. Consultarlo ANTES de diagnosticar un " +
        "problema técnico, buscando por marca, modelo o código de error (ej. \"SDM630 401\", \"MID-XL2\", " +
        "\"DerateMode\"): si ya pasó, la solución está acá. Cada palabra tiene que aparecer en el caso. Sin " +
        "búsqueda, trae los más recientes.",
      inputSchema: {
        busqueda: z.string().trim().max(200).optional().describe("Marca, modelo, código de error, síntoma o cliente"),
        project_id: z.string().optional().describe("Solo los casos de ese proyecto"),
        limite: z.number().int().min(1).max(50).optional().describe("Por defecto 15"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ busqueda, project_id, limite }) => {
      const where: Prisma.CasoTecnicoWhereInput = {
        deletedAt: null,
        ...(project_id ? { projectId: project_id } : {}),
        ...(busqueda ? { AND: filtroBusqueda(busqueda) } : {}),
      };
      const [casos, total] = await Promise.all([
        prisma.casoTecnico.findMany({ where, select: SELECT, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }], take: limite ?? 15 }),
        prisma.casoTecnico.count({ where: { deletedAt: null } }),
      ]);
      if (!casos.length) {
        return texto(
          `No hay casos que coincidan${busqueda ? ` con "${busqueda}"` : ""} (el registro tiene ${total}).`,
          "Probar con menos palabras o solo con la marca o el código de error.",
        );
      }
      return texto(
        `${casos.length} caso(s)${busqueda ? ` para "${busqueda}"` : " (los más recientes)"}, de ${total} en el registro:`,
        casos.map(formatear).join("\n\n"),
        "Los ✅ son datos y los ⚠️ deducciones de quien lo cargó. Un caso de otro modelo puede no aplicar igual.",
      );
    },
  );

  server.registerTool(
    "registrar_caso_tecnico",
    {
      title: "Registrar un problema técnico resuelto",
      description:
        "Carga en el registro común un problema técnico de obra o de planta que quedó RESUELTO en la " +
        "conversación (se sabe qué lo arregló). Hacerlo sin esperar a que lo pidan, apenas se confirma la " +
        "solución, y avisar al usuario en una línea. Lo ven todas las conversaciones y el asistente del " +
        "equipo. Equipos con marca, modelo exacto y número de serie. Separar dato (✅) de deducción (⚠️); si " +
        "la causa no se entendió del todo, decirlo. Incluir lo que se descartó y la lección, sobre todo si " +
        "algo que se creía resultó falso. Si el caso ya está cargado, usar corregir_caso_tecnico.",
      inputSchema: {
        titulo: campoTexto(160).describe("Corto: equipo + síntoma (ej. \"Smart meter con 401 en red sin neutro\")"),
        equipos: campoTexto(1500).describe("Marca, modelo exacto y serie de cada equipo; tipo de red"),
        sintoma: campoTexto(3000),
        causa: campoTexto(3000),
        solucion: campoTexto(3000),
        descartado: z.string().trim().max(3000).optional().describe("Lo que se revisó y no era"),
        leccion: z.string().trim().max(3000).optional().describe("Qué hacer la próxima vez"),
        etiquetas: z
          .array(z.string().trim().min(1).max(60))
          .max(25)
          .optional()
          .describe("Marcas, modelos, códigos de error y palabras clave para encontrarlo"),
        project_id: z.string().optional().describe("Proyecto de Voltia PM, si lo hay"),
        cliente: z.string().trim().max(200).optional().describe("Cliente u obra, si no hay proyecto"),
        fecha: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Día en que se resolvió, AAAA-MM-DD. Por defecto hoy"),
        es_otro_caso: z
          .boolean()
          .optional()
          .describe("true si ya hay un caso del mismo proyecto ese día y este es un problema distinto"),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      const fecha = args.fecha ?? diaUruguayIso(new Date());
      let projectLabel: string | undefined;
      if (args.project_id) {
        const p = await prisma.project.findFirst({
          where: { id: args.project_id, deletedAt: null },
          select: { code: true, clientName: true },
        });
        if (!p) return texto(`No encontré el proyecto ${args.project_id}. Cargarlo sin project_id y con cliente.`);
        projectLabel = `${p.clientName} (${p.code})`;

        if (!args.es_otro_caso) {
          const mismoDia = await prisma.casoTecnico.findMany({
            where: { projectId: args.project_id, fecha: new Date(`${fecha}T00:00:00.000Z`), deletedAt: null },
            select: SELECT,
          });
          if (mismoDia.length) {
            return texto(
              `Ya hay ${mismoDia.length} caso(s) de ${projectLabel} cargado(s) ese día. No se cargó nada.`,
              mismoDia.map(formatear).join("\n\n"),
              "Si es el mismo problema, completarlo con corregir_caso_tecnico. Si es otro, volver a llamar con es_otro_caso: true.",
            );
          }
        }
      }

      const etiquetas = [...new Set((args.etiquetas ?? []).map((e) => e.trim()).filter(Boolean))];
      const caso = await prisma.casoTecnico.create({
        data: {
          fecha: new Date(`${fecha}T00:00:00.000Z`),
          titulo: args.titulo,
          projectId: args.project_id ?? null,
          cliente: args.cliente ?? projectLabel ?? null,
          equipos: args.equipos,
          etiquetas,
          sintoma: args.sintoma,
          descartado: args.descartado ?? null,
          causa: args.causa,
          solucion: args.solucion,
          leccion: args.leccion ?? null,
          creadoPorId: user.id,
        },
        select: SELECT,
      });
      await createAuditEntry({
        entityType: AuditEntityType.caso_tecnico,
        entityId: caso.id,
        projectId: args.project_id ?? null,
        userId: user.id,
        action: AuditAction.created,
        description: `Caso técnico registrado desde el conector: ${caso.titulo}`,
      });
      return texto("Listo: el caso quedó en el registro común.", formatear(caso));
    },
  );

  server.registerTool(
    "corregir_caso_tecnico",
    {
      title: "Corregir o completar un caso técnico",
      description:
        "Corrige o completa un caso del registro (el id sale de buscar_casos_tecnicos): por ejemplo, cuando " +
        "después se confirma la causa, aparece la serie de un equipo o lo que se creía resultó falso. Solo " +
        "cambia los campos que se pasan; el texto nuevo REEMPLAZA al anterior, así que mandar el campo " +
        "completo. Con `eliminar: true` lo saca del registro (cargado por error o duplicado). Queda auditado.",
      inputSchema: {
        caso_id: z.string().min(1),
        titulo: campoTexto(160).optional(),
        equipos: campoTexto(1500).optional(),
        sintoma: campoTexto(3000).optional(),
        causa: campoTexto(3000).optional(),
        solucion: campoTexto(3000).optional(),
        descartado: z.string().trim().max(3000).optional(),
        leccion: z.string().trim().max(3000).optional(),
        etiquetas: z.array(z.string().trim().min(1).max(60)).max(25).optional().describe("Reemplaza la lista entera"),
        eliminar: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ caso_id, eliminar, ...cambios }) => {
      const antes = await prisma.casoTecnico.findFirst({ where: { id: caso_id, deletedAt: null }, select: SELECT });
      if (!antes) return texto(`No encontré ningún caso con el id ${caso_id}.`);

      if (eliminar) {
        await prisma.casoTecnico.update({ where: { id: caso_id }, data: { deletedAt: new Date() } });
        await createAuditEntry({
          entityType: AuditEntityType.caso_tecnico,
          entityId: caso_id,
          userId: user.id,
          action: AuditAction.deleted,
          description: `Caso técnico eliminado desde el conector: ${antes.titulo}`,
        });
        return texto("Listo: el caso salió del registro.", formatear(antes));
      }

      const data: Prisma.CasoTecnicoUpdateInput = {};
      const cambiados: string[] = [];
      for (const [k, v] of Object.entries(cambios)) {
        if (v === undefined) continue;
        const nuevo = k === "etiquetas" ? [...new Set(v as string[])] : v;
        (data as Record<string, unknown>)[k] = nuevo;
        cambiados.push(k);
      }
      if (!cambiados.length) return texto("No se pasó ningún campo para cambiar.", formatear(antes));

      const despues = await prisma.casoTecnico.update({ where: { id: caso_id }, data, select: SELECT });
      for (const k of cambiados) {
        const viejo = antes[k as keyof Caso];
        const nuevo = despues[k as keyof Caso];
        await createAuditEntry({
          entityType: AuditEntityType.caso_tecnico,
          entityId: caso_id,
          userId: user.id,
          action: AuditAction.updated,
          fieldChanged: k,
          oldValue: Array.isArray(viejo) ? viejo.join(", ") : (viejo as string | null),
          newValue: Array.isArray(nuevo) ? nuevo.join(", ") : (nuevo as string | null),
          description: `Caso técnico corregido desde el conector: ${despues.titulo}`,
        });
      }
      return texto(`Listo: se cambió ${cambiados.join(", ")}.`, formatear(despues));
    },
  );
}
