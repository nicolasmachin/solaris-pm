// Herramientas de obra para Operaciones: calendario de instalaciones,
// entregables de la obra, tickets y mantenimientos, informe del capataz, datos
// técnicos y la única escritura sobre el pipeline (marcar una subetapa).
//
// Todo se lee con los mismos servicios o las mismas consultas que la pantalla
// (calendario, galería de obra, documentos UTE firmados, visitas técnicas,
// tickets, listado de Experiencia Solar). El cambio de estado de una subetapa
// pasa por `services/substage-update.service.ts`, el mismo camino que el PATCH
// de la aplicación: mismas reglas, misma auditoría, mismo cierre de etapa y
// traspaso.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  Action,
  AuditAction,
  AuditEntityType,
  Module,
  StageType,
  SubstageStatus,
  TicketEstado,
  TipoEventoAgenda,
  TipoVideo,
  VideoProcessingStatus,
  type TeamType,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { hasPermission } from "../../../middleware/authorize.middleware.js";
import { STAGE_TYPE_TO_MODULE } from "../../../middleware/authorize-by-stage.middleware.js";
import { listAgendaEventos, TIPO_EVENTO_LABEL } from "../../../services/agenda/agenda.service.js";
import { createAuditEntry } from "../../../services/audit.service.js";
import { listClientesForExport } from "../../../services/clientes/index.js";
import { getDatosTecnicosObra } from "../../../services/datos-tecnicos-obra.service.js";
import { presupuestoManoDeObra } from "../../../services/installer-payment/installer-payment.service.js";
import { obrasSinFechaInstalacion } from "../../../services/ops-panel.service.js";
import { getStageLabel, PRESUPUESTO_MANO_DE_OBRA } from "../../../services/pipeline-definitions.js";
import { markSubstageActivity } from "../../../services/substage-activity.service.js";
import { actualizarSubetapa, validarCambioSubetapa } from "../../../services/substage-update.service.js";
import { listSuministros, numerosDeSuministro, SUMINISTRO_PRINCIPAL } from "../../../services/suministros.service.js";
import { AppError } from "../../../utils/errors.js";
import { hoyUruguay } from "../../../utils/uruguay.js";
import { requireAnyPermission, requirePermission, type McpUser } from "../context.js";
import { campos, fechaCorta, fechaLargaUruguay, texto, usd } from "../format.js";
import {
  buscarSubetapa,
  diaCorto,
  diaUtc,
  diasDelRango,
  ESTADO_SUBETAPA,
  ESTADO_SUBETAPA_LABEL,
  huecosLibres,
  isoDia,
  normalizar,
  ocuparTramo,
  sumarDias,
} from "./obra.logic.js";

function auditMeta(tool: string) {
  return { source: "mcp", tool };
}

/** Tope del texto de una respuesta (el resultado se corta cerca de 150.000). */
const TOPE_TEXTO = 120_000;
const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD");

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function tipoEquipo(t: TeamType | null | undefined) {
  return t === "TERCERIZADO" ? "tercerizado" : t === "PROPIO" ? "propio" : null;
}

function ubicacion(p: { locationCity: string | null; locationProvince: string | null; clientAddress?: string | null }) {
  return [p.clientAddress, p.locationCity, p.locationProvince].filter((x) => x && x.trim()).join(", ");
}

// ─── Checklist de fotos ──────────────────────────────────────────────────────
// Copia del "Checklist de fotos para entrega de obra" que muestra la galería de
// obra (`client/src/components/obra/checklistFotosData.ts`, que a su vez
// transcribe el PDF firmado). Si cambia allá, cambiar acá: el chat tiene que
// pedir las mismas fotos que el papel.
const CHECKLIST_FOTOS: Array<{ seccion: string; items: string[] }> = [
  {
    seccion: "Paneles y estructura",
    items: [
      "Paneles montados — ángulo 1",
      "Paneles montados — ángulo 2",
      "Estructura de montaje",
      "Tornillería",
      "Sujetadores finales e intermedios",
      "Etiqueta de datos del panel",
      "N° de serie del frente del panel",
    ],
  },
  {
    seccion: "Puesta a tierra",
    items: [
      "Puesta a tierra de los paneles",
      "Jabalina con la tierra conectada",
      "Jabalina con el telurímetro",
      "Medida del telurímetro — de cerca",
      "Medida del telurímetro — con contexto",
      "Cámara de registro",
    ],
  },
  { seccion: "Canalizaciones", items: ["Canalizaciones"] },
  {
    seccion: "Inversor y tableros (la serie de tablero se repite por cada tablero)",
    items: [
      "Conjunto inversor y tableros",
      "Inversor de frente",
      "Sticker de datos del inversor",
      "Tablero abierto",
      "Tablero con tapa puesta y puerta abierta",
      "Tablero cerrado con los stickers",
    ],
  },
  { seccion: "UTE", items: ["Medidor de UTE", "ICP general de UTE", "Precinto de seguridad"] },
];
const TOTAL_FOTOS_CHECKLIST = CHECKLIST_FOTOS.reduce((s, x) => s + x.items.length, 0);

const VIDEO_LABEL: Record<TipoVideo, string> = {
  ENSAYO_ENCENDIDO: "Ensayo encendido",
  ENSAYO_ANTI_ISLA: "Ensayo anti-isla",
  VISITA: "Visita",
  OTRO: "Otro",
};

const VIDEO_ESTADO: Record<VideoProcessingStatus, string> = {
  READY: "listo",
  PENDING: "procesándose",
  PROCESSING: "procesándose",
  FAILED: "falló el procesamiento",
};

const TICKET_ESTADO: Record<TicketEstado, string> = {
  ABIERTO: "Abierto",
  DERIVADO: "Derivado",
  EN_PROGRESO: "En progreso",
  RESUELTO: "Resuelto",
  CERRADO: "Cerrado",
};

const VISITA_TIPO: Record<string, string> = {
  INICIAL: "inicial",
  REVISION: "revisión",
  COMPLEMENTARIA: "complementaria",
};
const VISITA_ESTADO: Record<string, string> = {
  EN_CURSO: "en curso",
  FINALIZADA: "finalizada",
  ARCHIVADA: "archivada",
};

// Mismos títulos que el informe en pantalla y en el PDF (visitReportPdf).
const SECCIONES_INFORME: Array<{ key: string; titulo: string }> = [
  { key: "datosGenerales", titulo: "1. Datos generales" },
  { key: "acometida", titulo: "2. Acometida y conexión eléctrica" },
  { key: "techo", titulo: "3. Techo y estructura" },
  { key: "espacioInversor", titulo: "4. Espacio para inversor" },
  { key: "canalizaciones", titulo: "5. Canalizaciones" },
  { key: "observaciones", titulo: "6. Observaciones" },
  { key: "proximosPasos", titulo: "7. Próximos pasos" },
];

function marcaSubetapa(status: SubstageStatus) {
  return status === "COMPLETED" ? "✓" : status === "BLOCKED" ? "⨯" : status === "NO_APLICA" ? "–" : status === "IN_PROGRESS" ? "▸" : "·";
}

function recortar(s: string, max: number) {
  const limpio = s.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max)}…` : limpio;
}

/** Corta el texto total si se pasa del tope, avisando. */
function conTope(bloques: Array<string | null | undefined>) {
  const out: string[] = [];
  let total = 0;
  for (const b of bloques) {
    if (!b) continue;
    if (total + b.length > TOPE_TEXTO) {
      out.push(`${b.slice(0, Math.max(0, TOPE_TEXTO - total))}\n\n[Respuesta cortada por largo: el resto se ve en Voltia PM.]`);
      break;
    }
    out.push(b);
    total += b.length;
  }
  return texto(...out);
}

async function proyectoBasico(projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      code: true,
      clientName: true,
      locationCity: true,
      locationProvince: true,
      clientAddress: true,
      capacityKwp: true,
    },
  });
}

export function registerObraTools(server: McpServer, user: McpUser) {
  // ── Calendario de obras ──────────────────────────────────────────────────

  server.registerTool(
    "calendario_obras",
    {
      title: "Calendario de obras",
      description:
        "El calendario de instalaciones por equipo (cuadrillas propias y tercerizadas) en un " +
        "rango de fechas: cada obra con cliente, código, ubicación, sus tramos de días y si la " +
        "fecha está CONFIRMADA o es TENTATIVA (la agendó Ventas y Operaciones todavía no la " +
        "confirmó). Incluye los otros eventos de la agenda (mantenimientos, soportes, visitas " +
        "técnicas), los huecos libres de cada equipo en días hábiles y cuántas obras vendidas " +
        "siguen sin fecha. Por defecto desde hoy y las próximas 3 semanas. Usar para planificar " +
        "o para ver qué cuadrilla está libre.",
      inputSchema: {
        desde: fechaIso.optional().describe("Primer día, AAAA-MM-DD. Por defecto hoy (Uruguay)."),
        hasta: fechaIso.optional().describe("Último día, AAAA-MM-DD. Por defecto desde + 20 días."),
        equipo: z.string().min(1).optional().describe("Parte del nombre de un equipo, para ver solo ese."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ desde, hasta, equipo }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);

      const d = desde ?? hoyUruguay().iso;
      const h = hasta ?? sumarDias(d, 20);
      if (h < d) return texto("La fecha 'hasta' es anterior a 'desde'.");
      if (diasDelRango(d, h).length > 93) return texto("El rango máximo es de tres meses. Pedilo en tramos más cortos.");

      const [schedules, eventos, equipos, sinFecha] = await Promise.all([
        prisma.installationSchedule.findMany({
          where: {
            deletedAt: null,
            project: { deletedAt: null },
            segments: { some: { startDate: { lte: diaUtc(h) }, endDate: { gte: diaUtc(d) } } },
          },
          include: {
            project: {
              select: {
                id: true,
                code: true,
                clientName: true,
                locationCity: true,
                locationProvince: true,
                clientAddress: true,
                capacityKwp: true,
              },
            },
            team: { select: { id: true, name: true, type: true, deletedAt: true } },
            segments: { orderBy: { startDate: "asc" } },
          },
        }),
        listAgendaEventos({ desde: diaUtc(d), hasta: diaUtc(h) }),
        prisma.team.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
        obrasSinFechaInstalacion(),
      ]);

      // Un grupo por equipo vivo; las obras de un equipo borrado van con su
      // nombre guardado ("ex equipo") y los eventos sin equipo, aparte.
      interface Grupo {
        nombre: string;
        tipo: string | null;
        vivo: boolean;
        obras: string[];
        eventos: string[];
        ocupados: Set<string>;
        primerDia: Map<string, string>;
      }
      const grupos = new Map<string, Grupo>();
      const grupo = (key: string, nombre: string, tipo: string | null, vivo: boolean) => {
        let g = grupos.get(key);
        if (!g) {
          g = { nombre, tipo, vivo, obras: [], eventos: [], ocupados: new Set(), primerDia: new Map() };
          grupos.set(key, g);
        }
        return g;
      };
      for (const t of equipos) grupo(t.id, t.name, tipoEquipo(t.type), true);

      for (const s of schedules) {
        const vivo = !!s.team && s.team.deletedAt === null;
        const g = vivo
          ? grupo(s.team!.id, s.team!.name, tipoEquipo(s.team!.type), true)
          : grupo(`ex:${s.teamName}`, `${s.teamName} (ex equipo)`, tipoEquipo(s.teamType), false);
        const tramos = s.segments.map((seg) => {
          const a = isoDia(seg.startDate);
          const b = isoDia(seg.endDate);
          ocuparTramo(g.ocupados, a, b, d, h);
          return a === b ? diaCorto(a) : `${diaCorto(a)} a ${diaCorto(b)}`;
        });
        const p = s.project;
        const estado = s.actualWorkEnd
          ? `TERMINADA (${fechaCorta(s.actualWorkEnd)})`
          : s.confirmedAt
            ? "CONFIRMADA"
            : "TENTATIVA (sin confirmar)";
        const notas = [s.notes, ...s.segments.map((x) => x.notes)].filter((x) => x && x.trim());
        const linea =
          `- ${p.clientName} [${p.code}] · ${ubicacion(p) || "sin ubicación"}` +
          `${p.capacityKwp ? ` · ${Number(p.capacityKwp).toLocaleString("es-UY")} kWp` : ""}` +
          `\n  ${tramos.join(", ")} · ${estado} · project_id: ${p.id}` +
          (notas.length ? `\n  Notas: ${notas.map((n) => recortar(n!, 200)).join(" / ")}` : "");
        g.obras.push(linea);
        g.primerDia.set(linea, isoDia(s.segments[0].startDate));
      }

      for (const e of eventos) {
        const g = e.teamId
          ? grupo(e.teamId, e.teamName, tipoEquipo(equipos.find((t) => t.id === e.teamId)?.type), true)
          : grupo("sin-equipo", "Sin equipo asignado", null, false);
        const dias = e.dias.map((x) => x.fecha).filter((f) => f >= d && f <= h);
        for (const f of dias) g.ocupados.add(f);
        const linea =
          `- ${TIPO_EVENTO_LABEL[e.tipo]}: ${e.titulo}` +
          `${e.clientName ? ` · ${e.clientName}${e.projectCode ? ` [${e.projectCode}]` : ""}` : ""}` +
          ` · ${dias.map(diaCorto).join(", ")}${e.completadoEn ? " · hecho" : ""}`;
        g.eventos.push(linea);
        g.primerDia.set(linea, dias[0] ?? d);
      }

      let lista = [...grupos.values()];
      if (equipo) {
        const q = normalizar(equipo);
        lista = lista.filter((g) => normalizar(g.nombre).includes(q));
        if (lista.length === 0) {
          return texto(
            `No hay ningún equipo que coincida con "${equipo}".`,
            `Equipos: ${equipos.map((t) => t.name).join(", ") || "ninguno cargado"}.`,
          );
        }
      }

      const totalHabiles = diasDelRango(d, h).filter((x) => huecosLibres(x, x, new Set()).length > 0).length;
      const porFecha = (g: Grupo) => (a: string, b: string) => (g.primerDia.get(a) ?? "").localeCompare(g.primerDia.get(b) ?? "");

      const bloques = lista
        .sort((a, b) => Number(b.vivo) - Number(a.vivo) || a.nombre.localeCompare(b.nombre))
        .map((g) => {
          const cab = `${g.nombre.toUpperCase()}${g.tipo ? ` (${g.tipo})` : ""}`;
          const obras = g.obras.sort(porFecha(g));
          const evs = g.eventos.sort(porFecha(g));
          const partes = [cab];
          partes.push(obras.length ? `Obras:\n${obras.join("\n")}` : "Obras: ninguna en el período.");
          if (evs.length) partes.push(`Otros eventos:\n${evs.join("\n")}`);
          if (g.vivo) {
            const huecos = huecosLibres(d, h, g.ocupados);
            const libres = huecos.reduce((s, x) => s + x.diasHabiles, 0);
            partes.push(
              huecos.length === 0
                ? "Libre: ningún día hábil."
                : libres === totalHabiles
                  ? `Libre: todo el período (${plural(libres, "día hábil", "días hábiles")}).`
                  : `Libre (${plural(libres, "día hábil", "días hábiles")}): ` +
                    huecos
                      .map((x) =>
                        x.desde === x.hasta
                          ? diaCorto(x.desde)
                          : `${diaCorto(x.desde)} a ${diaCorto(x.hasta)} (${x.diasHabiles})`,
                      )
                      .join(" · "),
            );
          }
          return partes.join("\n");
        });

      const rowsSinFecha = sinFecha.rows;
      const bloqueSinFecha = rowsSinFecha.length
        ? `VENDIDAS SIN FECHA DE INSTALACIÓN (${rowsSinFecha.length})\n` +
          rowsSinFecha
            .slice(0, 10)
            .map(
              (r) =>
                `- ${r.clientName} [${r.code}]${r.locationCity ? ` · ${r.locationCity}` : ""} · ${r.diasDesdeVenta} días desde la venta`,
            )
            .join("\n") +
          (rowsSinFecha.length > 10 ? `\n  …y ${rowsSinFecha.length - 10} más (lista completa: obras_sin_fecha).` : "")
        : "Todas las obras vendidas tienen fecha de instalación.";

      return conTope([
        `Calendario de obras del ${diaCorto(d)} al ${diaCorto(h)} de ${h.slice(0, 4)}` +
          `${equipo ? ` — equipo "${equipo}"` : ""} (${plural(totalHabiles, "día hábil", "días hábiles")})`,
        bloques.join("\n\n"),
        equipo ? null : bloqueSinFecha,
        "Tentativa = la fecha la puso Ventas al agendar y Operaciones todavía no la confirmó " +
          "(se confirma en Validación de Operaciones). Los huecos cuentan lunes a viernes sin " +
          "feriados; un equipo con una obra ese día figura ocupado aunque la obra sea de medio día.",
      ]);
    },
  );

  // ── Entregables de la obra ───────────────────────────────────────────────

  server.registerTool(
    "entregables_obra",
    {
      title: "Entregables de la obra",
      description:
        "Controla los entregables de una obra terminada, como en el 'Control de obra' de " +
        "Ejecución de Obra: fotos contra el checklist de 23 fotos de entrega, videos de ensayo " +
        "(encendido y anti-isla) y el video de recorrido final (va como tipo 'Otro'), documentos " +
        "de UTE firmados, menciones al precinto y a la puesta a tierra, y el estado de las " +
        "subetapas de Ejecución de Obra con lo que falta tildar. Arranca con un resumen: completo " +
        "o qué falta. Dice explícitamente lo que la aplicación no registra.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      const p = await proyectoBasico(project_id);
      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const [fotos, videos, firmados, suministros, etapa] = await Promise.all([
        prisma.fileAttachment.findMany({
          where: { projectId: p.id, deletedAt: null, toolSource: "obra-fotos" },
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.projectVideo.findMany({
          where: { projectId: p.id, deletedAt: null },
          select: { tipoVideo: true, descripcion: true, processingStatus: true, createdAt: true, durationSeconds: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.fileAttachment.findMany({
          where: { projectId: p.id, deletedAt: null, toolSource: "ute-docs-firmados" },
          select: { filename: true, suministro: true, createdAt: true, uploadedBy: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        }),
        numerosDeSuministro(p.id),
        // Ejecución de Obra (pipeline actual) o la etapa Operaciones de las obras
        // con la estructura vieja.
        prisma.stage.findFirst({
          where: { projectId: p.id, deletedAt: null, name: { in: [StageType.EJECUCION_OBRA, StageType.OPERACIONES] } },
          orderBy: { order: "asc" },
          select: {
            name: true,
            status: true,
            substages: {
              where: { deletedAt: null, isActive: true },
              orderBy: { order: "asc" },
              select: {
                id: true,
                name: true,
                status: true,
                notes: true,
                user: { select: { name: true } },
                actualEndDate: true,
                checklistItems: {
                  where: { deletedAt: null },
                  orderBy: { order: "asc" },
                  select: { label: true, completed: true, isRequired: true, notes: true },
                },
              },
            },
          },
        }),
      ]);

      // ── Videos ──
      const deTipo = (t: TipoVideo) => videos.filter((v) => v.tipoVideo === t);
      const listo = (t: TipoVideo) => deTipo(t).some((v) => v.processingStatus === VideoProcessingStatus.READY);
      const estadoVideo = (t: TipoVideo) => {
        const vs = deTipo(t);
        if (vs.length === 0) return "NO está";
        if (listo(t)) return `está (${plural(vs.length, "video", "videos")})`;
        return `subido pero ${VIDEO_ESTADO[vs[0].processingStatus]}`;
      };

      // ── Documentos UTE firmados, por suministro ──
      const firmadosDe = (n: number) =>
        firmados.filter((f) => (f.suministro ?? SUMINISTRO_PRINCIPAL) === n);
      const variosSuministros = suministros.length > 1;

      // ── Menciones a precinto / puesta a tierra en texto libre ──
      // La aplicación no tiene un campo para el número de precinto ni para el
      // valor de puesta a tierra: van en el papel firmado del checklist de
      // fotos. Se buscan menciones en comentarios y notas para no decir "no
      // está" si alguien lo anotó.
      const patron = ["precinto", "tierra", "telur", "ohm", "Ω"];
      const [comentarios, notasChecklist] = await Promise.all([
        prisma.comment.findMany({
          where: {
            projectId: p.id,
            deletedAt: null,
            OR: patron.map((x) => ({ content: { contains: x, mode: "insensitive" as const } })),
          },
          select: { content: true, createdAt: true, author: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 8,
        }),
        prisma.checklistItem.findMany({
          where: {
            projectId: p.id,
            deletedAt: null,
            OR: patron.map((x) => ({ notes: { contains: x, mode: "insensitive" as const } })),
          },
          select: { label: true, notes: true },
          take: 8,
        }),
      ]);
      const menciones = [
        ...comentarios.map(
          (c) => `- ${fechaCorta(c.createdAt)}${c.author ? ` · ${c.author.name}` : ""} (comentario): ${recortar(c.content, 300)}`,
        ),
        ...notasChecklist.map((c) => `- Nota en "${c.label}": ${recortar(c.notes ?? "", 300)}`),
      ];

      // ── Resumen ──
      const faltan: string[] = [];
      if (fotos.length < TOTAL_FOTOS_CHECKLIST) {
        faltan.push(
          fotos.length === 0
            ? `Fotos de obra: no hay ninguna (el checklist pide ${TOTAL_FOTOS_CHECKLIST}).`
            : `Fotos de obra: hay ${fotos.length} y el checklist pide al menos ${TOTAL_FOTOS_CHECKLIST}.`,
        );
      }
      if (!listo(TipoVideo.ENSAYO_ENCENDIDO)) faltan.push(`Video del ensayo de encendido: ${estadoVideo(TipoVideo.ENSAYO_ENCENDIDO)}.`);
      if (!listo(TipoVideo.ENSAYO_ANTI_ISLA)) faltan.push(`Video del ensayo anti-isla: ${estadoVideo(TipoVideo.ENSAYO_ANTI_ISLA)}.`);
      if (!listo(TipoVideo.OTRO)) faltan.push("Video de recorrido final (tipo 'Otro'): no hay ninguno.");
      for (const n of suministros) {
        if (firmadosDe(n).length === 0) {
          faltan.push(`Documentos de UTE firmados${variosSuministros ? ` del suministro ${n}` : ""}: no se subió ninguno.`);
        }
      }
      const subsPendientes = etapa?.substages.filter((s) => s.status !== "COMPLETED" && s.status !== "NO_APLICA") ?? [];
      if (subsPendientes.length > 0) {
        faltan.push(`Subetapas de ${etapa ? getStageLabel(etapa.name) : "obra"} sin cerrar: ${subsPendientes.map((s) => s.name).join(", ")}.`);
      }

      const resumen =
        faltan.length === 0
          ? "RESUMEN: completo en todo lo que Voltia PM registra. Falta verificar a ojo que las fotos " +
            "cubran los 23 ítems del checklist, y el número de precinto y el valor de puesta a tierra " +
            "(van en el papel firmado, la aplicación no los guarda)."
          : `RESUMEN: faltan ${faltan.length} cosa${faltan.length > 1 ? "s" : ""}\n${faltan.map((f) => `- ${f}`).join("\n")}`;

      const bloqueFotos =
        `FOTOS DE OBRA: ${fotos.length} cargada${fotos.length === 1 ? "" : "s"}` +
        (fotos.length ? ` (la primera el ${fechaCorta(fotos[0].createdAt)}, la última el ${fechaCorta(fotos[fotos.length - 1].createdAt)})` : "") +
        `\nLa aplicación no etiqueta cada foto con su ítem del checklist: se puede contar, pero no saber ` +
        `cuál falta sin mirarlas (documentos_proyecto con incluir_fotos y leer_documentos). ` +
        `Las ${TOTAL_FOTOS_CHECKLIST} que pide el checklist:\n` +
        CHECKLIST_FOTOS.map((s) => `${s.seccion}: ${s.items.join(" · ")}`).join("\n");

      const bloqueVideos =
        "VIDEOS\n" +
        campos([
          ["Ensayo de encendido", estadoVideo(TipoVideo.ENSAYO_ENCENDIDO)],
          ["Ensayo anti-isla", estadoVideo(TipoVideo.ENSAYO_ANTI_ISLA)],
          ["Recorrido final (tipo 'Otro')", estadoVideo(TipoVideo.OTRO)],
          ["De la visita técnica", deTipo(TipoVideo.VISITA).length || null],
        ]) +
        (videos.some((v) => v.descripcion)
          ? `\n${videos
              .filter((v) => v.descripcion)
              .map((v) => `- ${VIDEO_LABEL[v.tipoVideo]} (${fechaCorta(v.createdAt)}): ${recortar(v.descripcion!, 200)}`)
              .join("\n")}`
          : "") +
        "\nEl recorrido final con el cliente no tiene un tipo propio: se sube como 'Otro', así que cualquier " +
        "video 'Otro' cuenta como tal.";

      const bloqueFirmados =
        "DOCUMENTOS DE UTE FIRMADOS\n" +
        suministros
          .map((n) => {
            const fs = firmadosDe(n);
            const cab = variosSuministros ? `Suministro ${n}: ` : "";
            return fs.length === 0
              ? `${cab}ninguno subido.`
              : `${cab}${fs.map((f) => `${f.filename} (${fechaCorta(f.createdAt)}${f.uploadedBy ? `, ${f.uploadedBy.name}` : ""})`).join("; ")}`;
          })
          .join("\n");

      const bloquePrecinto =
        "PRECINTO Y PUESTA A TIERRA\nVoltia PM no tiene campos para el número de precinto ni para el valor " +
        "medido de puesta a tierra: se anotan en el papel firmado del checklist de fotos y se ven en las " +
        "fotos 11, 12 y 23." +
        (menciones.length
          ? `\nMenciones encontradas en comentarios y notas de la obra:\n${menciones.join("\n")}`
          : "\nNo hay menciones en comentarios ni notas de la obra.");

      const bloqueEtapa = etapa
        ? `${getStageLabel(etapa.name).toUpperCase()} — ${etapa.status === "COMPLETED" ? "completada" : etapa.status === "IN_PROGRESS" ? "en curso" : "pendiente"}\n` +
          etapa.substages
            .map((s) => {
              const sinTildar = s.checklistItems.filter((c) => c.isRequired && !c.completed);
              const extra = [
                ESTADO_SUBETAPA_LABEL[s.status],
                s.user?.name,
                s.status === "COMPLETED" && s.actualEndDate ? `cerrada ${fechaCorta(s.actualEndDate)}` : null,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                `${marcaSubetapa(s.status)} ${s.name} (${extra})` +
                (sinTildar.length && s.status !== "COMPLETED" && s.status !== "NO_APLICA"
                  ? `\n    Falta tildar: ${sinTildar.map((c) => c.label).join(" · ")}`
                  : "")
              );
            })
            .join("\n")
        : "El proyecto no tiene etapa de Ejecución de Obra.";

      return conTope([
        `Entregables de la obra de ${p.clientName} [${p.code}]`,
        resumen,
        bloqueEtapa,
        bloqueVideos,
        bloqueFirmados,
        bloquePrecinto,
        bloqueFotos,
        "(✓ hecho · ▸ en progreso · · pendiente · ⨯ bloqueado · – no aplica). Para cambiar el estado de una " +
          "subetapa: marcar_subetapa.",
      ]);
    },
  );

  // ── Tickets y mantenimientos ─────────────────────────────────────────────

  server.registerTool(
    "tickets_y_mantenimientos",
    {
      title: "Tickets abiertos y mantenimientos próximos",
      description:
        "Los tickets de soporte abiertos (estado, antigüedad, cliente, a quién está asignado, a " +
        "qué área se derivó y si tiene un soporte agendado) y los mantenimientos que vienen: los " +
        "aniversarios de puesta en marcha de los próximos N días (60 por defecto) y los " +
        "mantenimientos ya agendados en el calendario. Cada parte se muestra si el usuario " +
        "tiene el permiso de esa pantalla. Se puede filtrar por proyecto.",
      inputSchema: {
        project_id: z.string().min(1).optional().describe("Solo un proyecto."),
        dias: z.number().int().min(1).max(365).optional().describe("Horizonte de mantenimientos. Por defecto 60."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, dias }) => {
      const [verTickets, verAniversarios, verAgenda] = await Promise.all([
        hasPermission(user.role, Module.TICKETS, Action.VIEW),
        hasPermission(user.role, Module.EXPERIENCIA_CLIENTES, Action.VIEW),
        hasPermission(user.role, Module.OPERACIONES, Action.VIEW),
      ]);
      if (!verTickets && !verAniversarios && !verAgenda) {
        await requireAnyPermission(user, [
          { module: Module.TICKETS, action: Action.VIEW },
          { module: Module.EXPERIENCIA_CLIENTES, action: Action.VIEW },
          { module: Module.OPERACIONES, action: Action.VIEW },
        ]);
      }

      const horizonte = dias ?? 60;
      const hoy = hoyUruguay().iso;
      const hasta = sumarDias(hoy, horizonte);
      const ahora = Date.now();
      const bloques: Array<string | null> = [];

      // Tickets (pantalla Tickets, TICKETS:VIEW).
      if (verTickets) {
        const tickets = await prisma.ticket.findMany({
          where: {
            deletedAt: null,
            estado: { notIn: [TicketEstado.RESUELTO, TicketEstado.CERRADO] },
            ...(project_id ? { projectId: project_id } : {}),
          },
          include: {
            project: { select: { id: true, clientName: true, code: true } },
            comentarios: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
            agendaEventos: {
              where: { deletedAt: null },
              select: { completadoEn: true, dias: { select: { fecha: true }, orderBy: { fecha: "asc" } } },
            },
          },
          orderBy: { createdAt: "asc" },
        });
        const ids = [...new Set(tickets.flatMap((t) => [t.creadoPorId, t.asignadoAId]).filter((x): x is string => !!x))];
        const nombres = new Map(
          (await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
        );
        const prioridad: Record<string, string> = { ALTA: "alta", MEDIA: "media", BAJA: "baja" };
        bloques.push(
          tickets.length === 0
            ? "TICKETS ABIERTOS: ninguno."
            : `TICKETS ABIERTOS (${tickets.length}, del más viejo al más nuevo)\n` +
                tickets
                  .map((t) => {
                    const dias = Math.floor((ahora - t.createdAt.getTime()) / 86_400_000);
                    const agendado = t.agendaEventos
                      .flatMap((e) => e.dias.map((x) => isoDia(x.fecha)))
                      .filter((f) => f >= hoy)
                      .sort();
                    const detalle = [
                      TICKET_ESTADO[t.estado],
                      `prioridad ${prioridad[t.prioridad] ?? t.prioridad.toLowerCase()}`,
                      `abierto hace ${plural(dias, "día", "días")} (${fechaLargaUruguay(t.createdAt)})`,
                      t.areaDerivada ? `derivado a ${t.areaDerivada === "OPERACIONES" ? "Operaciones" : "Ingeniería"}` : null,
                      t.asignadoAId ? `asignado a ${nombres.get(t.asignadoAId) ?? "?"}` : "sin asignar",
                      t.origenCliente ? "lo abrió el cliente desde el portal" : `lo abrió ${nombres.get(t.creadoPorId) ?? "?"}`,
                      t.comentarios[0] ? `último comentario ${fechaCorta(t.comentarios[0].createdAt)}` : "sin comentarios",
                      agendado.length ? `soporte agendado ${agendado.map(diaCorto).join(", ")}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return `- ${t.project.clientName} [${t.project.code}] — ${t.titulo}\n  ${detalle}\n  ${recortar(t.descripcion, 300)}`;
                  })
                  .join("\n"),
        );
      } else {
        bloques.push("Tickets: no se muestran (requiere TICKETS:VIEW).");
      }

      // Mantenimientos agendados en el calendario (OPERACIONES:VIEW).
      const agendados = verAgenda
        ? await listAgendaEventos({
            desde: diaUtc(hoy),
            hasta: diaUtc(hasta),
            tipos: [TipoEventoAgenda.MANTENIMIENTO],
            ...(project_id ? { projectId: project_id } : {}),
          })
        : [];
      const agendadoPorProyecto = new Map<string, string[]>();
      for (const e of agendados) {
        if (!e.projectId) continue;
        const ds = e.dias.map((x) => x.fecha).filter((f) => f >= hoy);
        agendadoPorProyecto.set(e.projectId, [...(agendadoPorProyecto.get(e.projectId) ?? []), ...ds]);
      }

      // Aniversarios de puesta en marcha (listado de Experiencia Solar,
      // EXPERIENCIA_CLIENTES:VIEW). Es el criterio de "mantenimiento por
      // aniversario": no se agendan solos, se listan para agendarlos a mano.
      if (verAniversarios) {
        const cartera = await listClientesForExport({ sortBy: "proximoMantenimiento", sortDir: "asc" });
        const proximos = cartera
          .filter((c) => c.mantenimiento && c.mantenimiento.diasRestantes <= horizonte)
          .filter((c) => !project_id || c.projectId === project_id)
          .sort((a, b) => a.mantenimiento!.diasRestantes - b.mantenimiento!.diasRestantes);
        bloques.push(
          proximos.length === 0
            ? `MANTENIMIENTOS POR ANIVERSARIO: ninguno en los próximos ${horizonte} días.`
            : `MANTENIMIENTOS POR ANIVERSARIO en los próximos ${horizonte} días (${proximos.length})\n` +
                proximos
                  .map((c) => {
                    const m = c.mantenimiento!;
                    const ag = agendadoPorProyecto.get(c.projectId);
                    return (
                      `- ${c.nombre}${c.codigo ? ` [${c.codigo}]` : ""}${c.departamento ? ` · ${c.departamento}` : ""}` +
                      `${c.potenciaKwp ? ` · ${c.potenciaKwp.toLocaleString("es-UY")} kWp` : ""}` +
                      ` · cumple ${plural(m.aniosQueCumple, "año", "años")} el ${fechaCorta(m.proximoAniversario)}` +
                      ` (${m.diasRestantes === 0 ? "hoy" : `en ${m.diasRestantes} días`})` +
                      (verAgenda ? (ag?.length ? ` · agendado ${ag.map(diaCorto).join(", ")}` : " · SIN agendar") : "")
                    );
                  })
                  .join("\n") +
                "\nAniversario = un año más desde el inicio de la post-habilitación (o la habilitación de UTE).",
        );
      } else {
        bloques.push("Mantenimientos por aniversario: no se muestran (requiere EXPERIENCIA_CLIENTES:VIEW).");
      }

      if (verAgenda) {
        bloques.push(
          agendados.length === 0
            ? `MANTENIMIENTOS AGENDADOS EN EL CALENDARIO: ninguno en los próximos ${horizonte} días.`
            : `MANTENIMIENTOS AGENDADOS EN EL CALENDARIO (${agendados.length})\n` +
                agendados
                  .map(
                    (e) =>
                      `- ${e.titulo}${e.clientName ? ` · ${e.clientName}${e.projectCode ? ` [${e.projectCode}]` : ""}` : ""}` +
                      ` · ${e.dias.map((x) => x.fecha).filter((f) => f >= hoy).map(diaCorto).join(", ")}` +
                      ` · ${e.teamName}${e.completadoEn ? " · hecho" : ""}`,
                  )
                  .join("\n"),
        );
      }

      return conTope([
        `Tickets y mantenimientos${project_id ? " del proyecto" : ""} (hoy ${fechaCorta(diaUtc(hoy))})`,
        ...bloques,
      ]);
    },
  );

  // ── Informe del capataz ──────────────────────────────────────────────────

  server.registerTool(
    "informe_capataz",
    {
      title: "Informe del capataz",
      description:
        "Lo que relevó el capataz en la visita técnica de una obra: cada visita con su informe " +
        "completo (las 7 secciones que arma la IA), las notas escritas y las transcripciones de " +
        "los audios, cuántas fotos y videos se cargaron, y el estado de la subetapa 'Informe del " +
        "capataz' de Validación de Operaciones con su checklist. Usar antes de agendar o para " +
        "repasar qué se encontró en el lugar.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      const p = await proyectoBasico(project_id);
      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const [visitas, subetapas] = await Promise.all([
        prisma.technicalVisit.findMany({
          where: { projectId: p.id, deletedAt: null },
          orderBy: { visitDate: "asc" },
          include: {
            createdBy: { select: { name: true, role: { select: { name: true } } } },
            inputs: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              select: {
                type: true,
                noteText: true,
                transcription: true,
                transcriptionStatus: true,
                description: true,
                createdAt: true,
                createdBy: { select: { name: true } },
              },
            },
            reports: { orderBy: { version: "desc" }, take: 1 },
            videos: { where: { deletedAt: null }, select: { id: true } },
          },
        }),
        prisma.substage.findMany({
          where: {
            projectId: p.id,
            deletedAt: null,
            isActive: true,
            stage: { deletedAt: null },
            name: { contains: "informe del capataz", mode: "insensitive" },
          },
          orderBy: { order: "asc" },
          select: {
            name: true,
            status: true,
            notes: true,
            user: { select: { name: true } },
            stage: { select: { name: true } },
            checklistItems: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
              select: { label: true, completed: true, isRequired: true, notes: true },
            },
          },
        }),
      ]);

      const bloqueSubetapas = subetapas.length
        ? "SUBETAPAS\n" +
          subetapas
            .map(
              (s) =>
                `${marcaSubetapa(s.status)} ${s.name} — ${getStageLabel(s.stage.name)} (${ESTADO_SUBETAPA_LABEL[s.status]}${s.user?.name ? `, ${s.user.name}` : ""})` +
                (s.notes?.trim() ? `\n    Notas: ${s.notes.trim()}` : "") +
                (s.checklistItems.length
                  ? "\n" +
                    s.checklistItems
                      .map((c) => `    [${c.completed ? "x" : " "}] ${c.label}${c.isRequired ? "" : " (opcional)"}${c.notes ? ` — ${c.notes}` : ""}`)
                      .join("\n")
                  : ""),
            )
            .join("\n")
        : "El proyecto no tiene la subetapa 'Informe del capataz' (puede ser una obra con el pipeline viejo).";

      if (visitas.length === 0) {
        return texto(
          `Informe del capataz de ${p.clientName} [${p.code}]`,
          "No hay ninguna visita técnica cargada para esta obra: el capataz no relevó nada en Voltia PM todavía.",
          bloqueSubetapas,
        );
      }

      const bloquesVisitas = visitas.map((v, i) => {
        const fotos = v.inputs.filter((x) => x.type === "PHOTO").length;
        const audios = v.inputs.filter((x) => x.type === "AUDIO");
        const sinTranscribir = audios.filter((a) => !a.transcription?.trim()).length;
        const cab =
          `VISITA ${i + 1} de ${visitas.length} — ${fechaLargaUruguay(v.visitDate)} · ${VISITA_TIPO[v.visitType] ?? v.visitType}` +
          ` · ${VISITA_ESTADO[v.status] ?? v.status} · cargada por ${v.createdBy.name} (${v.createdBy.role.name})`;
        const conteo = campos([
          ["Fotos", fotos],
          ["Audios", audios.length ? `${audios.length}${sinTranscribir ? ` (${sinTranscribir} sin transcripción)` : ""}` : 0],
          ["Notas escritas", v.inputs.filter((x) => x.type === "NOTE").length],
          ["Videos", v.videos.length],
        ]);

        const r = v.reports[0];
        let informe: string;
        if (!r) {
          informe = "INFORME: todavía no se generó.";
        } else {
          const content = (r.content ?? {}) as Record<string, string>;
          const nuevos = v.inputs.length - (r.inputsUsed?.length ?? 0);
          informe =
            `INFORME (actualizado el ${fechaLargaUruguay(r.generatedAt)}` +
            `${nuevos > 0 ? `; hay ${nuevos} carga${nuevos > 1 ? "s" : ""} posteriores que no entraron` : ""})` +
            (r.summary?.trim() ? `\nResumen: ${r.summary.trim()}` : "") +
            "\n\n" +
            SECCIONES_INFORME.map((s) => `${s.titulo}\n${content[s.key]?.trim() || "(vacío)"}`).join("\n\n");
        }

        const cargas = v.inputs
          .filter((x) => x.type !== "PHOTO")
          .map((x) => {
            const quien = `${fechaCorta(x.createdAt)} · ${x.createdBy.name}${x.description ? ` · ${x.description}` : ""}`;
            if (x.type === "NOTE") return `- Nota (${quien}): ${x.noteText?.trim() || "(vacía)"}`;
            return `- Audio (${quien}): ${x.transcription?.trim() || `sin transcripción (${x.transcriptionStatus?.toLowerCase() ?? "sin estado"})`}`;
          });

        return [
          cab,
          v.notes?.trim() ? `Notas de la visita: ${v.notes.trim()}` : null,
          conteo,
          informe,
          cargas.length ? `NOTAS Y AUDIOS TAL COMO SE CARGARON\n${cargas.join("\n")}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });

      return conTope([
        `Informe del capataz de ${p.clientName} [${p.code}] — ${plural(visitas.length, "visita técnica", "visitas técnicas")}`,
        bloqueSubetapas,
        ...bloquesVisitas,
        "Las fotos no se adjuntan acá: se ven en Voltia PM, en la visita.",
      ]);
    },
  );

  // ── Datos técnicos de la obra ────────────────────────────────────────────

  server.registerTool(
    "datos_tecnicos_obra",
    {
      title: "Datos técnicos de la obra",
      description:
        "Los datos técnicos que Operaciones necesita para planificar una obra: paneles, " +
        "inversor, red (mono o trifásica), techo y si va coplanar o inclinado, según la " +
        "pre-ingeniería, el unifilar y el sistema del proyecto, con lo que no coincide; los " +
        "suministros (cuenta UTE, dirección, inversor de cada uno); y el presupuesto de mano de " +
        "obra al instalador tercerizado, solo si el usuario puede verlo.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      const p = await proyectoBasico(project_id);
      if (!p) return texto(`No encontré ningún proyecto con el id ${project_id}.`);

      const [dt, suministros, subPresupuesto] = await Promise.all([
        getDatosTecnicosObra(p.id),
        listSuministros(p.id),
        prisma.substage.findFirst({
          where: { projectId: p.id, deletedAt: null, isActive: true, name: PRESUPUESTO_MANO_DE_OBRA },
          select: { status: true, checklistItems: { where: { deletedAt: null }, select: { label: true, completed: true } } },
        }),
      ]);

      const fase: Record<string, string> = {
        MONOFASICO: "monofásica",
        TRIFASICO_230: "trifásica 230 V",
        TRIFASICO_400: "trifásica 400 V",
      };
      const red = (r: string[]) => (r.length ? r.map((x) => fase[x] ?? x).join(" y ") : null);

      const pre = dt.preIngenieria;
      const bloquePre = pre
        ? `PRE-INGENIERÍA (v${pre.versionNumber}, la fuente)\n` +
          campos([
            ["Paneles", pre.cantidadPanelesTexto ?? pre.cantidadPaneles],
            ["Potencia del panel", pre.potenciaPanelW ? `${pre.potenciaPanelW} W` : null],
            ["Inversor", pre.inversor],
            ["Red", red(pre.red)],
            ["Techo", pre.techo],
            ["Montaje", pre.inclinacion === "COPLANAR" ? "coplanar" : pre.inclinacion === "INCLINADO" ? "inclinado" : null],
          ])
        : "PRE-INGENIERÍA: no hay ninguna versión.";

      const u = dt.unifilar;
      const bloqueUnifilar = u
        ? "UNIFILAR\n" +
          campos([
            ["Versiones vigentes", u.versiones.map((v) => `suministro ${v.suministro}: v${v.versionNumber}`).join(", ")],
            ["Paneles", u.cantidadPaneles],
            ["Potencia del panel", u.potenciasPanelW.length ? `${u.potenciasPanelW.join(" y ")} W` : null],
            ["Inversor(es)", `${u.inversorKw.toLocaleString("es-UY")} kW`],
            ["Red", red(u.red)],
            ["Suministros sin unifilar", u.suministrosSinUnifilar.length ? u.suministrosSinUnifilar.join(", ") : null],
          ])
        : "UNIFILAR: no hay ninguno.";

      const s = dt.sistema;
      const bloqueSistema = s
        ? "SISTEMA DEL PROYECTO (lo que muestran Proyectos y la lista)\n" +
          campos([
            ["Paneles", s.cantidadPaneles],
            ["Potencia del panel", s.potenciasPanelW.length ? `${s.potenciasPanelW.join(" y ")} W` : null],
            ["Inversor(es)", s.inversorKw != null ? `${s.inversorKw.toLocaleString("es-UY")} kW` : null],
            ["Red", red(s.red)],
          ])
        : null;

      const prop = dt.propuesta;
      const bloquePropuesta = prop
        ? `PROPUESTA GANADORA (v${prop.versionNumber}, solo de referencia)\n` +
          campos([
            ["Montaje", prop.tipoMontaje],
            ["Paneles", prop.cantidadPaneles],
            ["Inversor", prop.potenciaInversorKw != null ? `${prop.potenciaInversorKw} kW` : null],
          ])
        : null;

      const bloqueFaltantes = dt.faltantes.length
        ? `LO QUE FALTA O NO COINCIDE\n${dt.faltantes.map((f) => `- ${f.mensaje}`).join("\n")}`
        : "Pre-ingeniería, unifilar y sistema coinciden.";

      const bloqueSuministros = suministros.length
        ? `SUMINISTROS (${suministros.length})\n` +
          suministros
            .map(
              (x) =>
                `- Suministro ${x.numero}: ` +
                [
                  x.cuentaUte ? `cuenta UTE ${x.cuentaUte}` : "sin cuenta UTE cargada",
                  `${x.calle} ${x.numCalle}`.trim() || null,
                  [x.localidad, x.departamento].filter(Boolean).join(", ") || null,
                  x.titularPropio ? `titular ${x.titularNombre}` : null,
                  x.inversor ?? "sin inversor cargado",
                  x.paneles != null ? `${x.paneles} paneles${x.panelW ? ` de ${x.panelW} W` : ""}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
            )
            .join("\n")
        : null;

      // Presupuesto de mano de obra: misma regla que GET /projects/:id/mano-de-obra
      // (installer-payment.routes.ts): PAGOS_INSTALADOR:VIEW, y además ver los
      // pagos de todos (FINANZAS:VIEW o PAGOS_INSTALADOR:EDIT) o ser el
      // instalador de ese pago.
      let bloqueManoDeObra: string;
      const [verPagos, verFinanzas, gestionaPagos] = await Promise.all([
        hasPermission(user.role, Module.PAGOS_INSTALADOR, Action.VIEW),
        hasPermission(user.role, Module.FINANZAS, Action.VIEW),
        hasPermission(user.role, Module.PAGOS_INSTALADOR, Action.EDIT),
      ]);
      let puede = verPagos && (verFinanzas || gestionaPagos);
      if (verPagos && !puede) {
        const pago = await prisma.installerPayment.findUnique({ where: { projectId: p.id }, select: { installerId: true } });
        puede = pago?.installerId === user.id;
      }
      if (!puede) {
        bloqueManoDeObra =
          "PRESUPUESTO AL INSTALADOR TERCERIZADO: no se muestra (lo ven quienes ven los pagos a instaladores, o el instalador de esta obra).";
      } else {
        const mo = await presupuestoManoDeObra(p.id);
        bloqueManoDeObra =
          "PRESUPUESTO AL INSTALADOR TERCERIZADO (mano de obra)\n" +
          (mo.montoUsd == null
            ? "No hay monto: la obra no tiene pago al instalador y la propuesta ganadora no trae mano de obra."
            : campos([
                ["Monto", usd(mo.montoUsd)],
                [
                  "De dónde sale",
                  mo.origen === "PAGO"
                    ? "el pago al instalador ya creado (lo que se le va a pagar)"
                    : `la propuesta ganadora v${mo.versionNumber}, calculado hoy`,
                ],
              ]));
      }
      if (subPresupuesto) {
        bloqueManoDeObra +=
          `\nSubetapa "${PRESUPUESTO_MANO_DE_OBRA}": ${ESTADO_SUBETAPA_LABEL[subPresupuesto.status]}` +
          (subPresupuesto.checklistItems.length
            ? ` (${subPresupuesto.checklistItems.map((c) => `${c.completed ? "✓" : "·"} ${c.label}`).join("; ")})`
            : "");
      }

      return texto(
        `Datos técnicos de ${p.clientName} [${p.code}]` +
          `${p.capacityKwp ? ` · ${Number(p.capacityKwp).toLocaleString("es-UY")} kWp` : ""}` +
          `${ubicacion(p) ? ` · ${ubicacion(p)}` : ""}`,
        bloquePre,
        bloqueUnifilar,
        bloqueSistema,
        bloqueFaltantes,
        bloquePropuesta,
        bloqueSuministros,
        bloqueManoDeObra,
      );
    },
  );

  // ── Marcar subetapa (escritura) ──────────────────────────────────────────

  server.registerTool(
    "marcar_subetapa",
    {
      title: "Cambiar el estado de una subetapa",
      description:
        "Cambia el estado de una subetapa del pipeline de una obra (pendiente, en progreso, " +
        "bloqueado, completado, no aplica), con una nota opcional que queda como comentario en " +
        "esa subetapa. Pasa por las mismas reglas que la pantalla: completar la última subetapa " +
        "cierra la etapa y dispara el traspaso al área siguiente, y reabrir una puede volver la " +
        "etapa atrás. SIN confirmar: true solo muestra qué cambiaría; llamarla con confirmar: " +
        "true únicamente después de que la persona vio ese resumen y dijo que sí.",
      inputSchema: {
        project_id: z.string().min(1),
        subetapa: z.string().min(2).describe("Nombre de la subetapa (o parte) o su id."),
        estado: z.enum(["PENDIENTE", "EN_PROGRESO", "BLOQUEADO", "COMPLETADO", "NO_APLICA"]),
        nota: z.string().min(1).max(4000).optional().describe("Queda como comentario en la subetapa."),
        confirmar: z
          .boolean()
          .optional()
          .describe("true solo si la persona ya vio el resumen y confirmó. Sin esto no se escribe nada."),
      },
    },
    async ({ project_id, subetapa, estado, nota, confirmar }) => {
      const p = await prisma.project.findFirst({
        where: { id: project_id, deletedAt: null },
        select: { id: true, code: true, clientName: true, modalidadPago: true },
      });
      if (!p) {
        await requirePermission(user, Module.OPERACIONES, Action.VIEW);
        return texto(`No encontré ningún proyecto con el id ${project_id}.`);
      }

      const subs = await prisma.substage.findMany({
        where: { projectId: p.id, deletedAt: null, isActive: true, stage: { deletedAt: null } },
        include: {
          stage: { select: { id: true, name: true, order: true, status: true } },
          checklistItems: { where: { deletedAt: null, isRequired: true }, orderBy: { order: "asc" } },
        },
        orderBy: [{ stage: { order: "asc" } }, { order: "asc" }],
      });

      const encontradas = buscarSubetapa(subs, subetapa);
      if (encontradas.length === 0) {
        await requirePermission(user, Module.OPERACIONES, Action.VIEW);
        const porEtapa = new Map<string, string[]>();
        for (const s of subs) {
          const k = getStageLabel(s.stage.name);
          porEtapa.set(k, [...(porEtapa.get(k) ?? []), s.name]);
        }
        return texto(
          `No encontré una subetapa "${subetapa}" en ${p.clientName} [${p.code}]. Las que tiene:`,
          [...porEtapa].map(([e, ns]) => `${e}: ${ns.join(" · ")}`).join("\n"),
        );
      }
      if (encontradas.length > 1) {
        await requirePermission(user, Module.OPERACIONES, Action.VIEW);
        return texto(
          `"${subetapa}" coincide con ${encontradas.length} subetapas. Decime cuál (podés pasar el id):`,
          encontradas
            .map((s) => `- ${s.name} — ${getStageLabel(s.stage.name)} (${ESTADO_SUBETAPA_LABEL[s.status]}) · id: ${s.id}`)
            .join("\n"),
        );
      }

      const sub = encontradas[0];
      const nuevo = ESTADO_SUBETAPA[estado];
      const etapaLabel = getStageLabel(sub.stage.name);

      // Permisos: espejo de authorizeByStageContext en el PATCH de la app.
      // EDIT del módulo de la etapa; para completar, además COMPLETE.
      const modulo = STAGE_TYPE_TO_MODULE[sub.stage.name];
      await requirePermission(user, modulo, Action.EDIT);
      if (nuevo === SubstageStatus.COMPLETED) await requirePermission(user, modulo, Action.COMPLETE);

      if (sub.status === nuevo && !nota) {
        return texto(`"${sub.name}" (${etapaLabel}) ya está en ${ESTADO_SUBETAPA_LABEL[nuevo]}. No hay nada que cambiar.`);
      }

      const cambiaEstado = sub.status !== nuevo;
      const body = cambiaEstado ? { status: nuevo } : {};

      // Reglas de negocio antes de mostrar o escribir: si no se puede, se dice ya.
      try {
        await validarCambioSubetapa({ projectId: p.id, stageId: sub.stage.id, substage: sub, body });
      } catch (err) {
        if (err instanceof AppError) {
          return texto(`No se puede pasar "${sub.name}" a ${ESTADO_SUBETAPA_LABEL[nuevo]}:`, err.message);
        }
        throw err;
      }

      // Consecuencias, para que la persona sepa qué dispara.
      const resuelta = (s: SubstageStatus) => s === SubstageStatus.COMPLETED || s === SubstageStatus.NO_APLICA;
      const hermanas = subs.filter((s) => s.stage.id === sub.stage.id && s.id !== sub.id);
      const consecuencias: string[] = [];
      if (cambiaEstado && resuelta(nuevo) && hermanas.every((s) => resuelta(s.status)) && sub.stage.status !== "COMPLETED") {
        consecuencias.push(
          `Es la última subetapa pendiente de ${etapaLabel}: la etapa se completa sola y se dispara el traspaso ` +
            "al área siguiente (le llega el aviso para confirmarlo).",
        );
      }
      if (cambiaEstado && resuelta(sub.status) && !resuelta(nuevo) && sub.stage.status === "COMPLETED") {
        consecuencias.push(`${etapaLabel} está completada: al reabrir esta subetapa la etapa vuelve a en curso.`);
      }
      if (cambiaEstado && nuevo === SubstageStatus.COMPLETED) {
        const sinTildar = sub.checklistItems.filter(
          (c) => !c.completed && (!c.appliesWhenModalidadPago || c.appliesWhenModalidadPago === p.modalidadPago),
        );
        if (sinTildar.length) {
          consecuencias.push(
            `Ojo: el checklist tiene ${plural(sinTildar.length, "ítem obligatorio", "ítems obligatorios")} sin tildar ` +
              `(${sinTildar.map((c) => c.label).join(" · ")}). La pantalla deja completar igual al cambiar el estado; ` +
              "conviene revisarlo antes.",
          );
        }
        consecuencias.push("Se avisa al responsable de la subetapa siguiente.");
      }

      const cambio = cambiaEstado
        ? `${ESTADO_SUBETAPA_LABEL[sub.status]} → ${ESTADO_SUBETAPA_LABEL[nuevo]}`
        : `sigue en ${ESTADO_SUBETAPA_LABEL[nuevo]} (solo se agrega la nota)`;

      if (confirmar !== true) {
        return texto(
          `Esto es lo que haría (todavía NO cambié nada):`,
          campos([
            ["Obra", `${p.clientName} [${p.code}]`],
            ["Etapa", etapaLabel],
            ["Subetapa", sub.name],
            ["Estado", cambio],
            ["Nota", nota ? `"${nota}" (queda como comentario en la subetapa)` : null],
          ]),
          consecuencias.length ? consecuencias.map((c) => `- ${c}`).join("\n") : null,
          "Si está bien, confirmame y lo hago (marcar_subetapa con confirmar: true).",
        );
      }

      // Escritura: el mismo servicio que el PATCH de la aplicación.
      let etapaCompletada = false;
      if (cambiaEstado) {
        try {
          const { syncedStage } = await actualizarSubetapa({
            projectId: p.id,
            stageId: sub.stage.id,
            substage: sub,
            body,
            userId: user.id,
            auditMetadata: auditMeta("marcar_subetapa"),
          });
          etapaCompletada = sub.stage.status !== "COMPLETED" && syncedStage?.status === "COMPLETED";
        } catch (err) {
          if (err instanceof AppError) {
            return texto(`No se pudo pasar "${sub.name}" a ${ESTADO_SUBETAPA_LABEL[nuevo]}:`, err.message);
          }
          throw err;
        }
      }

      if (nota) {
        const comment = await prisma.comment.create({
          data: { content: nota, authorId: user.id, projectId: p.id, stageId: sub.stage.id, substageId: sub.id },
        });
        await createAuditEntry({
          entityType: AuditEntityType.comment,
          entityId: comment.id,
          projectId: p.id,
          userId: user.id,
          action: AuditAction.comment_added,
          description: `Agregó un comentario en el proyecto '${p.clientName}'`,
          metadata: { ...auditMeta("marcar_subetapa"), stageId: sub.stage.id, substageId: sub.id },
        });
        await markSubstageActivity(sub.id);
      }

      return texto(
        cambiaEstado
          ? `Listo: "${sub.name}" (${etapaLabel}) de ${p.clientName} pasó a ${ESTADO_SUBETAPA_LABEL[nuevo]}.`
          : `Listo: agregué la nota en "${sub.name}" (${etapaLabel}) de ${p.clientName}.`,
        etapaCompletada ? `${etapaLabel} quedó completada y se disparó el traspaso al área siguiente.` : null,
        cambiaEstado && nota ? "La nota quedó como comentario en la subetapa." : null,
      );
    },
  );
}

