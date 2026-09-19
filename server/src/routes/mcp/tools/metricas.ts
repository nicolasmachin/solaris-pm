// Métricas por chat: los indicadores del mail semanal para cualquier período,
// el avance de las metas y los tiempos por etapa de obra. Todo lectura.
//
// Las cuentas salen de los mismos servicios que usan el dashboard y el mail de
// los lunes (`services/metricas/`). Acá solo se elige el período y se redacta.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, GoalArea, GoalPeriod, Module } from "@prisma/client";
import { z } from "zod";

import {
  avanceMetas,
  indicadoresDelPeriodo,
  type Indicadores,
} from "../../../services/metricas/indicadores.service.js";
import { tiemposPorEtapa } from "../../../services/metricas/tiempos-etapa.service.js";
import { requirePermission, type McpUser } from "../context.js";
import { campos, fechaCorta, texto, usd } from "../format.js";
import {
  enHoraUruguay,
  hoyUruguay,
  periodoAnterior,
  periodoInput,
  resolverPeriodo,
  type PeriodoPedido,
} from "../periodo.js";

const TOPE = 40;

function num(n: number, decimales = 0) {
  return n.toLocaleString("es-UY", { maximumFractionDigits: decimales });
}

function dias(n: number | null) {
  return n == null ? "—" : `${num(n, 1)} días`;
}

/** "12 (antes 9, +33%)" cuando hay comparación. */
function conDelta(actual: number, antes: number | undefined, fmt: (n: number) => string = (n) => num(n, 2)) {
  if (antes === undefined) return fmt(actual);
  if (antes === 0) return `${fmt(actual)} (antes ${fmt(antes)})`;
  const pct = Math.round(((actual - antes) / antes) * 100);
  return `${fmt(actual)} (antes ${fmt(antes)}, ${pct >= 0 ? "+" : ""}${pct}%)`;
}

function lista<T>(items: T[], renglon: (x: T) => string, tope = TOPE) {
  const cuerpo = items.slice(0, tope).map(renglon).join("\n");
  return items.length > tope ? `${cuerpo}\n  …y ${items.length - tope} más.` : cuerpo;
}

const AREA_LABEL: Record<string, string> = {
  [GoalArea.VENTAS]: "Ventas",
  [GoalArea.OPERACIONES]: "Operaciones",
};

export function registerMetricasTools(server: McpServer, user: McpUser) {
  server.registerTool(
    "indicadores",
    {
      title: "Indicadores de un período",
      description:
        "Los indicadores del reporte semanal, para cualquier período: leads nuevos, " +
        "propuestas enviadas, visitas realizadas, ventas cerradas con su monto, ventas " +
        "perdidas, conversión, tiempos promedio del embudo, obras realizadas y kWp " +
        "instalados. Sirve para una semana, un mes, un trimestre, un año o un rango de " +
        "fechas. Con `comparar` muestra la diferencia contra el período anterior; con " +
        "`por_asesor`, el desglose por vendedor; con `detalle`, la lista de ventas, " +
        "visitas y obras. Sin período, el mes en curso.",
      inputSchema: {
        ...periodoInput,
        comparar: z.boolean().optional().describe("Comparar contra el período anterior equivalente."),
        por_asesor: z.boolean().optional().describe("Desglose por vendedor."),
        detalle: z.boolean().optional().describe("Listar cada venta, visita y obra del período."),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      await requirePermission(user, Module.METRICAS, Action.VIEW);
      const pedido: PeriodoPedido = args;
      const periodo = resolverPeriodo(pedido);
      const rango = enHoraUruguay(periodo);
      const anteriorP = args.comparar ? periodoAnterior(pedido) : null;

      const [d, a] = await Promise.all([
        indicadoresDelPeriodo(rango.inicio, rango.fin),
        anteriorP ? indicadoresDelPeriodo(enHoraUruguay(anteriorP).inicio, enHoraUruguay(anteriorP).fin) : null,
      ]);
      const antes = <K>(f: (x: Indicadores) => K) => (a ? f(a) : undefined);

      const ticket = d.ventas.length ? d.facturacionVendidaUsd / d.ventas.length : null;

      const comercial = campos([
        ["Leads nuevos", conDelta(d.leads, antes((x) => x.leads))],
        ["Propuestas enviadas", conDelta(d.propuestas, antes((x) => x.propuestas))],
        ["Visitas realizadas", conDelta(d.visitas.length, antes((x) => x.visitas.length))],
        ["Ventas cerradas", conDelta(d.ventas.length, antes((x) => x.ventas.length))],
        [
          "Monto vendido (con IVA)",
          conDelta(d.facturacionVendidaUsd, antes((x) => x.facturacionVendidaUsd), (n) => usd(n) ?? "—"),
        ],
        ["Ticket promedio", ticket != null ? usd(ticket) : null],
        ["Ventas perdidas", conDelta(d.perdidas, antes((x) => x.perdidas))],
        [
          "Conversión (ganadas / cerradas)",
          d.conversion != null ? `${num(d.conversion, 1)}%` + (a?.conversion != null ? ` (antes ${num(a.conversion, 1)}%)` : "") : "— (no se cerró ninguna)",
        ],
      ]);

      const tiempos = campos([
        ["Lead → propuesta", dias(d.tiempos.leadAPropuesta)],
        ["Propuesta → visita", dias(d.tiempos.propuestaAVisita)],
        ["Visita → cierre", dias(d.tiempos.visitaACierre)],
        ["Propuesta → cierre", dias(d.tiempos.propuestaACierre)],
      ]);

      const obra = campos([
        ["Obras realizadas", conDelta(d.obras.count, antes((x) => x.obras.count))],
        ["kWp instalados", conDelta(d.obras.kwp, antes((x) => x.obras.kwp))],
        ["Obras ponderadas", d.obras.ponderadas !== d.obras.count ? num(d.obras.ponderadas) : null],
        ["Gastos cargados en el sistema", `${d.gastosRegistrados} movimientos`],
      ]);

      const ventasTxt = d.ventas.length
        ? `VENTAS\n${lista(d.ventas, (v) => `- ${fechaCorta(v.fecha)} · ${v.cliente} [${v.code}] · ${v.asesor ?? "sin asesor"} · ${usd(v.montoUsd) ?? "sin monto"}`)}`
        : null;

      const detalle = args.detalle
        ? [
            d.visitas.length
              ? `VISITAS\n${lista(d.visitas, (v) => `- ${fechaCorta(v.fecha)} · ${v.cliente} · ${v.asesor ?? "sin asesor"}`)}`
              : null,
            d.obras.items.length
              ? `OBRAS REALIZADAS\n${lista(
                  [...d.obras.items].sort((x, y) => x.installedAt.getTime() - y.installedAt.getTime()),
                  (o) =>
                    `- ${fechaCorta(o.installedAt)} · ${o.clientName} [${o.code}] · ${num(o.capacityKwp, 2)} kWp` +
                    (o.liviana ? " · cargada por planilla" : ""),
                )}`
              : null,
          ]
        : [];

      const asesores =
        args.por_asesor && d.porAsesor.length
          ? "POR ASESOR\n" +
            d.porAsesor
              .map(
                (x) =>
                  `- ${x.asesor}: ${x.leads} leads · ${x.propuestas} propuestas · ${x.visitas} visitas · ` +
                  `${x.ventas} ventas (${usd(x.montoUsd)}) · ${x.perdidas} perdidas`,
              )
              .join("\n")
          : null;

      return texto(
        `Indicadores — ${periodo.etiqueta}` + (anteriorP ? `\nComparado con: ${anteriorP.etiqueta}` : ""),
        `COMERCIAL\n${comercial}`,
        `TIEMPOS PROMEDIO DEL EMBUDO (de lo que llegó a cada hito en el período)\n${tiempos}`,
        `OBRA\n${obra}`,
        ventasTxt,
        asesores,
        ...detalle,
        "Cortes a medianoche de Uruguay, como el mail de los lunes. El dashboard corta a " +
          "medianoche UTC (21:00 de Uruguay): un número puede diferir en uno si algo pasó en esas horas del borde.",
      );
    },
  );

  server.registerTool(
    "metas",
    {
      title: "Avance de las metas",
      description:
        "Cómo vienen las metas cargadas en la aplicación: leads, propuestas, ventas, " +
        "instalaciones y kWp. Para cada meta dice objetivo, lo logrado, el porcentaje y si va " +
        "al ritmo del tiempo transcurrido. Por defecto las del trimestre en curso y las anuales.",
      inputSchema: {
        anio: z.number().int().min(2020).max(2100).optional().describe("Por defecto el año en curso."),
        trimestre: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("Por defecto el trimestre en curso si el año es el actual; si no, solo las anuales."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ anio, trimestre }) => {
      await requirePermission(user, Module.METRICAS, Action.VIEW);
      const hoy = hoyUruguay();
      const a = anio ?? hoy.anio;
      const t = trimestre ?? (a === hoy.anio ? Math.floor((hoy.mes - 1) / 3) + 1 : undefined);

      const now = new Date();
      const rangoAnio = enHoraUruguay(resolverPeriodo({ anio: a }));
      const rangoTrimestre = t ? enHoraUruguay(resolverPeriodo({ anio: a, trimestre: t })) : undefined;
      const metas = await avanceMetas({ anio: a, trimestre: t, rangoAnio, rangoTrimestre, now });
      if (metas.length === 0) {
        return texto(
          `No hay metas cargadas para ${t ? `el ${t}.º trimestre ni para ` : ""}el año ${a}. ` +
            "Se cargan en Configuración → Metas.",
        );
      }

      // Un período que ya terminó no está "atrasado": se cumplió o no.
      const renglon = (m: (typeof metas)[number]) => {
        const cerrado = (m.period === GoalPeriod.QUARTERLY ? rangoTrimestre ?? rangoAnio : rangoAnio).fin <= now;
        const estado = cerrado
          ? m.actual >= m.objetivo ? "CUMPLIDA" : "NO CUMPLIDA"
          : m.enRitmo ? "en ritmo" : "ATRASADA";
        return (
          `- ${m.etiqueta} (${AREA_LABEL[m.area] ?? m.area}): ${num(m.actual, 2)} de ${num(m.objetivo, 2)} · ` +
          `${m.porcentaje}% · ${estado}`
        );
      };
      const trimestrales = metas.filter((m) => m.period === GoalPeriod.QUARTERLY);
      const anuales = metas.filter((m) => m.period === GoalPeriod.ANNUAL);

      return texto(
        `Metas ${a}`,
        trimestrales.length ? `${t}.º TRIMESTRE\n${trimestrales.map(renglon).join("\n")}` : null,
        anuales.length ? `AÑO ${a}\n${anuales.map(renglon).join("\n")}` : null,
        "\"En ritmo\" = lo logrado va al menos en la proporción del tiempo que pasó del período. " +
          "Se mide con cortes a medianoche de Uruguay; el dashboard corta a medianoche UTC.",
      );
    },
  );

  server.registerTool(
    "tiempos_etapas",
    {
      title: "Tiempos por etapa de obra",
      description:
        "Cuánto duran en la realidad las etapas del proceso de obra (ingeniería, ejecución, " +
        "trámite UTE, etc.): promedio, mínimo y máximo en días, y qué porcentaje terminó " +
        "dentro del plazo configurado. Es la tabla de tiempos del dashboard. Con período, " +
        "solo las etapas que terminaron en ese período; sin período, todo el histórico.",
      inputSchema: { ...periodoInput },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      await requirePermission(user, Module.METRICAS, Action.VIEW);
      const hayPeriodo = Object.values(args).some((v) => v !== undefined);
      // Mismo corte que el dashboard (medianoche UTC): las etapas guardan su
      // fecha de fin como día, y así el año o trimestre coincide con la pantalla.
      const periodo = hayPeriodo ? resolverPeriodo(args) : null;
      const filas = await tiemposPorEtapa(periodo ? { inicio: periodo.inicio, fin: periodo.fin } : undefined);
      const conDatos = filas.filter((f) => f.completedCount > 0);
      if (conDatos.length === 0) return texto(`No terminó ninguna etapa ${periodo ? periodo.etiqueta : ""}.`.trim());

      return texto(
        `Tiempos por etapa — ${periodo ? periodo.etiqueta : "todo el histórico"}`,
        conDatos
          .map(
            (f) =>
              `- ${f.stageLabel}: ${f.completedCount} terminadas · promedio ${num(f.avgActualDays, 1)} días ` +
              `(mín ${f.minActualDays}, máx ${f.maxActualDays})` +
              (f.slaDiasHabiles
                ? ` · plazo ${f.slaDiasHabiles} días hábiles · ${f.complianceRate ?? "—"}% en plazo` +
                  (f.avgDelayBusinessDays != null
                    ? ` · ${f.avgDelayBusinessDays > 0 ? `${num(f.avgDelayBusinessDays, 1)} días hábiles de atraso promedio` : "en promedio dentro del plazo"}`
                    : "")
                : " · sin plazo configurado"),
          )
          .join("\n"),
        "Días corridos entre el inicio y el fin real de cada etapa; el plazo se mide en días hábiles.",
      );
    },
  );
}
