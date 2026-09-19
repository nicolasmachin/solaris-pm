// Control de etapas y tiempos por chat: lo que muestra el panel de operaciones
// del dashboard. Todo lectura y "en vivo" (el estado de hoy, no un período).
//
// Las cuentas salen de `services/ops-panel.service.ts`, las mismas funciones
// que responden los endpoints /ops/* del dashboard.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, Module, StageType } from "@prisma/client";
import { z } from "zod";

import {
  clientesSinComunicacion,
  controlEtapas,
  obrasSinFechaInstalacion,
  panelUte,
  type FilaControlEtapa,
} from "../../../services/ops-panel.service.js";
import { getSlaMap } from "../../../services/stage-sla.service.js";
import { getStageLabel } from "../../../services/pipeline-definitions.js";
import { requirePermission, type McpUser } from "../context.js";
import { campos, fechaCorta, texto } from "../format.js";

const TOPE = 50;

type Area = "ventas" | "ingenieria" | "operaciones" | "ute" | "experiencia_solar";

// Área de cada etapa. Es el mismo mapeo que agrupa las tarjetas del dashboard
// (`client/src/constants/stages.ts` → STAGE_AREA); si cambia allá, cambiar acá.
const AREA_POR_ETAPA: Partial<Record<StageType, Area>> = {
  [StageType.ONBOARDING]: "ventas",
  [StageType.INGENIERIA]: "ingenieria",
  [StageType.OPERACIONES]: "operaciones",
  [StageType.HABILITACION_UTE]: "ute",
  [StageType.POSTVENTA]: "experiencia_solar",
  [StageType.PRE_INGENIERIA]: "ingenieria",
  [StageType.VALIDACION_OPERACIONES]: "operaciones",
  [StageType.INGENIERIA_FINAL]: "ingenieria",
  [StageType.COMPRAS]: "operaciones",
  [StageType.EJECUCION_OBRA]: "operaciones",
  [StageType.TRAMITACION_UTE]: "ute",
  [StageType.POST_HABILITACION]: "experiencia_solar",
  [StageType.SEGUIMIENTO_PREOBRA]: "experiencia_solar",
  [StageType.SEGUIMIENTO_HABILITACION]: "experiencia_solar",
};

const AREA_LABEL: Record<Area, string> = {
  ventas: "Ventas",
  ingenieria: "Ingeniería",
  operaciones: "Operaciones",
  ute: "Trámite UTE",
  experiencia_solar: "Experiencia Solar",
};

const UTE_SUBETAPA: Record<string, string> = {
  CONSULTA: "Consulta",
  SOLICITUD: "Solicitud",
  DOCS_1: "Documentación 1",
  DOCS_2: "Documentación 2",
  RELEVAR: "Relevamiento",
  ENSAYOS: "Ensayos",
  FINALIZADO: "Finalizado",
};

function areaDe(etapa: StageType | null): Area | null {
  return etapa ? AREA_POR_ETAPA[etapa] ?? null : null;
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function renglonEtapa(f: FilaControlEtapa) {
  const cd = f.countdown!;
  const cuando =
    cd.status === "overdue"
      ? `VENCIDA hace ${plural(Math.abs(cd.remainingBusinessDays), "día hábil", "días hábiles")} (venció ${fechaCorta(cd.deadline)})`
      : `vence en ${plural(cd.remainingBusinessDays, "día hábil", "días hábiles")} (${fechaCorta(cd.deadline)})`;
  return (
    `- ${f.clientName} [${f.code}] · ${f.etapaLabel} · ${cuando}` +
    ` · lleva ${cd.elapsedBusinessDays} de ${cd.slaDiasHabiles}` +
    (f.responsable ? ` · responsable: ${f.responsable}` : "")
  );
}

function lista<T>(items: T[], renglon: (x: T) => string, tope = TOPE) {
  const cuerpo = items.slice(0, tope).map(renglon).join("\n");
  return items.length > tope ? `${cuerpo}\n  …y ${items.length - tope} más.` : cuerpo;
}

export function registerOperacionesTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "control_etapas",
    {
      title: "Control de etapas y plazos",
      description:
        "Qué obras tienen la etapa actual vencida o por vencer, contra el plazo configurado " +
        "para cada etapa (en días hábiles). Es el control de tiempos del panel de operaciones " +
        "del dashboard y el filtro 'Solo vencidos' de Proyectos. Por defecto lista las vencidas " +
        "y las que vencen en los próximos días, de la más atrasada a la menos. Se puede filtrar " +
        "por área (ventas, ingeniería, operaciones, UTE, Experiencia Solar). Da además el resumen " +
        "por etapa y avisa qué etapas no tienen plazo. Las etapas de Experiencia Solar no " +
        "llevan plazo: su control es la cadencia de contacto, que da sin_comunicacion.",
      inputSchema: {
        estado: z
          .enum(["vencidas", "vencidas_y_por_vencer", "todas"])
          .optional()
          .describe("Por defecto vencidas_y_por_vencer. 'todas' incluye las que están en plazo."),
        area: z
          .enum(["ventas", "ingenieria", "operaciones", "ute", "experiencia_solar"])
          .optional()
          .describe("Solo las obras cuya etapa actual es de esa área."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ estado, area }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      const modo = estado ?? "vencidas_y_por_vencer";

      const todas = await controlEtapas();
      const filas = area ? todas.filter((f) => areaDe(f.etapa) === area) : todas;

      const vencidas = filas.filter((f) => f.countdown?.status === "overdue");
      const porVencer = filas.filter((f) => f.countdown?.status === "warning");
      const enPlazo = filas.filter((f) => f.countdown?.status === "ok");
      const sinPlazo = filas.filter((f) => !f.countdown);

      const porRemanente = (a: FilaControlEtapa, b: FilaControlEtapa) =>
        a.countdown!.remainingBusinessDays - b.countdown!.remainingBusinessDays;

      // Resumen por etapa: dónde se acumulan las vencidas.
      const porEtapa = new Map<string, { vencidas: number; porVencer: number; enPlazo: number; sinPlazo: number }>();
      for (const f of filas) {
        const k = f.etapaLabel ?? "Sin etapa";
        const r = porEtapa.get(k) ?? { vencidas: 0, porVencer: 0, enPlazo: 0, sinPlazo: 0 };
        if (!f.countdown) r.sinPlazo++;
        else if (f.countdown.status === "overdue") r.vencidas++;
        else if (f.countdown.status === "warning") r.porVencer++;
        else r.enPlazo++;
        porEtapa.set(k, r);
      }
      const resumenEtapas = [...porEtapa.entries()]
        .sort((a, b) => b[1].vencidas - a[1].vencidas || b[1].porVencer - a[1].porVencer)
        .map(
          ([etapa, r]) =>
            `- ${etapa}: ${[
              r.vencidas && plural(r.vencidas, "vencida", "vencidas"),
              r.porVencer && `${r.porVencer} por vencer`,
              r.enPlazo && `${r.enPlazo} en plazo`,
              r.sinPlazo && `${r.sinPlazo} sin plazo`,
            ]
              .filter(Boolean)
              .join(" · ")}`,
        )
        .join("\n");

      const listado =
        modo === "vencidas"
          ? vencidas.sort(porRemanente)
          : modo === "vencidas_y_por_vencer"
            ? [...vencidas, ...porVencer].sort(porRemanente)
            : [...vencidas, ...porVencer, ...enPlazo].sort(porRemanente);

      // Las etapas sin plazo no pueden vencer: se dice cuáles son para que no
      // se lea "0 vencidas" como "todo en orden". Las de Experiencia Solar no
      // admiten plazo por diseño (Admin las excluye): se controlan por cadencia
      // de contacto.
      const slaMap = await getSlaMap();
      const sinPlazoTipos = [...new Set(sinPlazo.map((f) => f.etapa).filter((e): e is StageType => !!e))].filter(
        (e) => !slaMap.has(e),
      );
      const sinPlazoPorDiseno = sinPlazoTipos.filter((e) => areaDe(e) === "experiencia_solar").map(getStageLabel);
      const sinPlazoConfigurable = sinPlazoTipos.filter((e) => areaDe(e) !== "experiencia_solar").map(getStageLabel);

      return texto(
        `Control de etapas — obras en curso${area ? ` en ${AREA_LABEL[area]}` : ""} (hoy)`,
        campos([
          ["Vencidas", vencidas.length],
          ["Por vencer (2 días hábiles o menos)", porVencer.length],
          ["En plazo", enPlazo.length],
          ["Sin plazo configurado", sinPlazo.length || null],
          ["Total", filas.length],
        ]),
        filas.length ? `POR ETAPA\n${resumenEtapas}` : null,
        listado.length
          ? `${modo === "vencidas" ? "VENCIDAS" : modo === "todas" ? "TODAS" : "VENCIDAS Y POR VENCER"}\n${lista(listado, renglonEtapa)}`
          : modo === "todas"
            ? null
            : "No hay etapas vencidas ni por vencer.",
        sinPlazoConfigurable.length
          ? `Sin plazo configurado (no pueden figurar como vencidas): ${sinPlazoConfigurable.join(", ")}. ` +
              "Se configura en Administración → Plazos por etapa."
          : null,
        sinPlazoPorDiseno.length || area === "experiencia_solar"
          ? "Las etapas de Experiencia Solar no llevan plazo: el seguimiento se controla por la cadencia " +
              "de contacto de cada recorrido E1/E2/E3 (herramienta sin_comunicacion)."
          : null,
        "Plazos en días hábiles, contados desde que la obra llegó a la etapa (cierre de la etapa anterior).",
      );
    },
  );

  server.registerTool(
    "sin_comunicacion",
    {
      title: "Clientes sin comunicación",
      description:
        "Clientes con los que no se registra contacto hace más de lo que marca su recorrido " +
        "(E1, E2 o E3, cada uno con su cadencia configurada), o que nunca tuvieron un contacto " +
        "registrado. Incluye obras en curso y terminadas: es el control de seguimiento de " +
        "Experiencia Solar del panel de operaciones. De más atrasado a menos.",
      inputSchema: {
        recorrido: z.enum(["E1", "E2", "E3"]).optional().describe("Solo un recorrido."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ recorrido }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      const { rows } = await clientesSinComunicacion();
      const filas = recorrido ? rows.filter((r) => r.recorrido === recorrido) : rows;
      if (filas.length === 0) {
        return texto(`Todos los clientes${recorrido ? ` de ${recorrido}` : ""} están dentro de su cadencia de contacto.`);
      }

      const nunca = filas.filter((r) => r.sinContacto);
      const conAtraso = filas.filter((r) => !r.sinContacto);
      const porRecorrido = ["E1", "E2", "E3"]
        .map((e) => [e, filas.filter((r) => r.recorrido === e).length] as const)
        .filter(([, n]) => n > 0)
        .map(([e, n]) => `${e}: ${n}`)
        .join(" · ");

      return texto(
        `${filas.length} cliente${filas.length > 1 ? "s" : ""} fuera de su cadencia de contacto`,
        campos([
          ["Por recorrido", porRecorrido],
          ["Nunca contactados", nunca.length || null],
        ]),
        conAtraso.length
          ? `CON CONTACTO ATRASADO\n${lista(
              conAtraso,
              (r) =>
                `- ${r.clientName} [${r.code}] · ${r.recorrido}${r.stageLabel ? ` · ${r.stageLabel}` : ""} · ` +
                `${r.diasSinContacto} días sin contacto (objetivo ${r.cadenciaObjetivo}, ${r.atraso} de atraso)` +
                ` · último ${fechaCorta(r.ultimoContactoEn)}`,
            )}`
          : null,
        nunca.length
          ? `SIN NINGÚN CONTACTO REGISTRADO\n${lista(
              nunca,
              (r) => `- ${r.clientName} [${r.code}] · ${r.recorrido}${r.stageLabel ? ` · ${r.stageLabel}` : ""}`,
            )}`
          : null,
        "Cuenta las interacciones registradas (llamadas, WhatsApp, mails, visitas). Para anotar una, registrar_interaccion.",
      );
    },
  );

  server.registerTool(
    "obras_sin_fecha",
    {
      title: "Obras vendidas sin fecha de instalación",
      description:
        "Proyectos vendidos, no terminados, que todavía no tienen la instalación agendada, " +
        "ordenados por días desde la venta. Con el estado del plazo de su etapa actual.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      const { rows } = await obrasSinFechaInstalacion();
      if (rows.length === 0) return texto("Todas las obras vendidas tienen fecha de instalación.");
      const estado: Record<string, string> = { overdue: "etapa VENCIDA", warning: "etapa por vencer", ok: "etapa en plazo" };
      return texto(
        `${rows.length} obra${rows.length > 1 ? "s" : ""} vendida${rows.length > 1 ? "s" : ""} sin fecha de instalación`,
        lista(
          rows,
          (r) =>
            `- ${r.clientName} [${r.code}]${r.locationCity ? ` · ${r.locationCity}` : ""}` +
            `${r.capacityKwp ? ` · ${r.capacityKwp.toLocaleString("es-UY")} kWp` : ""} · ${r.diasDesdeVenta} días desde la venta` +
            `${r.stageLabel ? ` · ${r.stageLabel}` : ""}${r.status ? ` (${estado[r.status]})` : ""}`,
        ),
      );
    },
  );

  server.registerTool(
    "panel_ute",
    {
      title: "Panel de trámites UTE",
      description:
        "Los trámites de UTE sin habilitar: cuántos días llevan desde la venta, en qué " +
        "sub-etapa están y si la pelota la tiene Voltia o UTE. Más el reparto de espera y " +
        "cuánto tarda UTE en promedio en responder cada paso. Es la banda UTE del panel de " +
        "operaciones. Para el trámite de un proyecto puntual, usar tramite_ute.",
      inputSchema: {
        esperando: z.enum(["voltia", "ute"]).optional().describe("Solo los que esperan a Voltia o a UTE."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ esperando }) => {
      await requirePermission(user, Module.OPERACIONES, Action.VIEW);
      const { sinHabilitar, reparto, promedioPorSubEtapa } = await panelUte();
      const filtro = esperando === "voltia" ? "US" : esperando === "ute" ? "UTE" : null;
      const filas = filtro ? sinHabilitar.filter((r) => r.esperandoA === filtro) : sinHabilitar;
      const quien = (w: string | null) => (w === "US" ? "le toca a Voltia" : w === "UTE" ? "esperando a UTE" : "sin movimientos");
      const dias = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-UY")} días`);

      return texto(
        "Trámites UTE sin habilitar",
        campos([
          ["En trámite", reparto.totalActivos],
          ["Le toca a Voltia", reparto.esperandoNosotros],
          ["Esperando a UTE", reparto.esperandoUTE],
          ["Tiempo promedio nuestro", dias(reparto.avgOurDays)],
          ["Tiempo promedio de UTE", dias(reparto.avgUteDays)],
          ["Tiempo promedio total", dias(reparto.avgTotalDays)],
        ]),
        filas.length
          ? `${filtro ? (filtro === "US" ? "LE TOCA A VOLTIA" : "ESPERANDO A UTE") : "POR DÍAS DESDE LA VENTA"}\n${lista(
              filas,
              (r) =>
                `- ${r.clientName} [${r.code}] · ${r.diasDesdeVenta} días desde la venta · ` +
                `${UTE_SUBETAPA[r.subEtapa] ?? r.subEtapa} · ${quien(r.esperandoA)}`,
            )}`
          : "No hay trámites con ese filtro.",
        "RESPUESTA DE UTE (promedio de todos los trámites)\n" +
          promedioPorSubEtapa
            .map((p) => `- ${p.label}: ${dias(p.avgDias)}${p.muestras ? ` (${p.muestras} trámites)` : ""}`)
            .join("\n"),
      );
    },
  );
}
