// Peso de las obras por chat: cuánto vale cada obra en la métrica de "obras
// ponderadas" (una obra grande puede valer por varias) y cambiarlo.
//
// Es el mismo campo `pesoObra` que se edita en la ficha del proyecto, con la
// misma regla: entero de 1 a 999 y solo lo cambia un ADMIN (en la ruta HTTP la
// restricción es por rol, no por la matriz de permisos; acá se copia igual).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, AuditAction, AuditEntityType, Module, ProjectStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { createAuditEntry } from "../../../services/audit.service.js";
import { listarObrasRealizadas } from "../../../services/metricas/indicadores.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { campos, fechaCorta, texto } from "../format.js";

const TOPE = 150;

const ESTADO: Record<ProjectStatus, string> = {
  PROSPECT: "prospecto",
  ACTIVE: "en curso",
  COMPLETED: "finalizado",
  PAUSED: "en pausa",
  ARCHIVED: "archivado",
};

function kwp(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })} kWp` : "sin kWp";
}

export function registerPesoObrasTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "peso_obras",
    {
      title: "Peso (ponderación) de las obras",
      description:
        "Cuánto vale cada obra en la métrica de obras ponderadas (dashboard e indicadores): " +
        "por defecto toda obra vale 1 y una grande puede valer más. Sin filtros muestra el " +
        "reparto (cuántas obras valen 1, 2, 3…) y la lista de las que valen distinto de 1. " +
        "Con `buscar` (cliente o código) muestra esas obras; con `todas`, todas. Con `anio`, " +
        "solo las obras realizadas ese año, con el total de obras y de obras ponderadas.",
      inputSchema: {
        buscar: z.string().trim().min(2).optional().describe("Nombre del cliente o código del proyecto"),
        todas: z.boolean().optional().describe("Listar también las que valen 1"),
        anio: z.number().int().min(2020).max(2100).optional().describe("Solo obras realizadas ese año"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ buscar, todas, anio }) => {
      await requirePermission(user, Module.METRICAS, Action.VIEW);

      const proyectos = await prisma.project.findMany({
        where: {
          deletedAt: null,
          ...(buscar
            ? {
                OR: [
                  { clientName: { contains: buscar, mode: "insensitive" } },
                  { code: { contains: buscar, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          code: true,
          clientName: true,
          capacityKwp: true,
          pesoObra: true,
          status: true,
          excludedFromMetrics: true,
          importedFromCsv: true,
        },
        orderBy: [{ pesoObra: "desc" }, { code: "asc" }],
      });

      // Fecha de obra realizada (la misma definición que usan las métricas).
      const realizadas = new Map((await listarObrasRealizadas()).map((o) => [o.projectId, o.installedAt]));
      let lista = proyectos;
      if (anio) {
        lista = lista.filter((p) => realizadas.get(p.id)?.getUTCFullYear() === anio);
      }

      const reparto = new Map<number, number>();
      for (const p of lista) if (!p.excludedFromMetrics) reparto.set(p.pesoObra, (reparto.get(p.pesoObra) ?? 0) + 1);
      const repartoTxt = [...reparto.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([peso, n]) => `${n} ${n === 1 ? "obra vale" : "obras valen"} ${peso}`)
        .join(" · ");

      const mostrar = buscar || todas ? lista : lista.filter((p) => p.pesoObra !== 1);
      const renglon = (p: (typeof lista)[number]) => {
        const fin = realizadas.get(p.id);
        return (
          `- ${p.clientName} [${p.code}] · vale ${p.pesoObra} · ${kwp(p.capacityKwp)} · ${ESTADO[p.status]}` +
          (fin ? ` · obra realizada el ${fechaCorta(fin)}` : "") +
          (p.excludedFromMetrics ? " · fuera de las métricas" : "") +
          (p.importedFromCsv ? " · cargada por planilla" : "") +
          ` · id ${p.id}`
        );
      };
      const cuerpo = mostrar.slice(0, TOPE).map(renglon).join("\n");

      const enMetricas = lista.filter((p) => !p.excludedFromMetrics);
      return texto(
        campos([
          ["Alcance", [buscar ? `búsqueda "${buscar}"` : null, anio ? `obras realizadas en ${anio}` : null].filter(Boolean).join(", ") || "todos los proyectos"],
          ["Reparto", repartoTxt || "ninguna obra"],
          anio ? ["Obras realizadas", String(enMetricas.length)] : ["Proyectos", String(enMetricas.length)],
          ["Suma ponderada", String(enMetricas.reduce((s, p) => s + p.pesoObra, 0))],
        ]),
        mostrar.length
          ? `${buscar || todas ? "OBRAS" : "OBRAS QUE VALEN DISTINTO DE 1"}\n${cuerpo}` +
              (mostrar.length > TOPE ? `\n  …y ${mostrar.length - TOPE} más.` : "")
          : buscar
            ? `No encontré proyectos para "${buscar}".`
            : "Todas valen 1.",
        "Los proyectos fuera de las métricas se listan pero no suman.",
      );
    },
  );

  server.registerTool(
    "cambiar_peso_obra",
    {
      title: "Cambiar el peso de una obra",
      description:
        "Cambia cuánto vale una obra en la métrica de obras ponderadas (entero de 1 a 999; 1 " +
        "es una obra normal). Solo un administrador. Sin `confirmar: true` solo muestra el " +
        "cambio. Buscar antes el proyecto con peso_obras o buscar_proyecto y usar su id.",
      inputSchema: {
        project_id: z.string().min(1),
        peso: z.number().int().min(1).max(999),
        motivo: z.string().trim().max(500).optional().describe("Por qué vale eso; queda en el historial"),
        confirmar: z.boolean().optional(),
      },
    },
    async ({ project_id, peso, motivo, confirmar }) => {
      await requirePermission(user, Module.METRICAS, Action.VIEW);
      if (user.role !== "ADMIN") {
        return texto("Solo un administrador puede cambiar el peso de una obra (la misma regla que en la ficha del proyecto).");
      }
      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: { id: true, code: true, clientName: true, capacityKwp: true, pesoObra: true },
      });
      if (!p) return texto(`No encontré el proyecto ${project_id}.`);
      if (p.pesoObra === peso) return texto(`${p.clientName} [${p.code}] ya vale ${peso}. No cambié nada.`);

      const vista = campos([
        ["Proyecto", `${p.clientName} [${p.code}] · ${kwp(p.capacityKwp)}`],
        ["Peso actual", String(p.pesoObra)],
        ["Peso nuevo", String(peso)],
        ["Motivo", motivo ?? "—"],
      ]);
      if (!confirmar) return texto(vista, "Vista previa: no se cambió nada. Para aplicarlo, volver a llamar con confirmar: true.");

      await prisma.project.update({ where: { id: p.id }, data: { pesoObra: peso } });
      await createAuditEntry({
        entityType: AuditEntityType.project,
        entityId: p.id,
        projectId: p.id,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "peso de la obra",
        oldValue: String(p.pesoObra),
        newValue: String(peso),
        description: `Cambió el peso de la obra de ${p.pesoObra} a ${peso}` + (motivo ? `: ${motivo}` : ""),
        metadata: { source: "mcp", tool: "cambiar_peso_obra" },
      });
      return texto(`Listo: ${p.clientName} [${p.code}] pasa a valer ${peso} (antes ${p.pesoObra}).`, "Las métricas lo toman desde ya.");
    },
  );
}
