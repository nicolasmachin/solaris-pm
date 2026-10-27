// Herramientas para analizar cómo funciona una planta: generación día por día,
// curva por hora, inversor y medidor en vivo, e incidencias del monitoreo.
//
// Son todas de lectura. Existen para que el equipo (Operaciones, Experiencia
// Solar) haga desde el chat el diagnóstico que antes se hacía consultando el
// servidor a mano: "¿por qué Rodolfo genera menos?", "¿el medidor quedó al
// revés?". El análisis lo hace el modelo; acá sólo se le dan los datos y se
// marcan las cosas físicamente imposibles, que son las que delatan un error de
// conexión (exportar más de lo que se genera, exportar de noche).
//
// Permiso: el mismo del panel de monitoreo (EXPERIENCIA_CLIENTES:VIEW).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Action, FvDiagnostico, FvIncidenciaEstado, Module, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../../lib/prisma.js";
import { obtenerCurvaDia, hoyUy } from "../../../services/reportesFv/energia/curva.service.js";
import { growattPostCrudo } from "../../../services/reportesFv/growatt/client.js";
import { historialInversor, webConfigurada, type RegistroInversor } from "../../../services/reportesFv/growatt/web.client.js";
import { huaweiPausa, pedir as pedirHuawei } from "../../../services/reportesFv/huawei/client.js";
import { DIAGNOSTICO_LABEL } from "../../../services/reportesFv/monitor/diagnostico.js";
import { dateADia, diaADate, esDiaValido, sumarDias, type Dia } from "../../../services/reportesFv/monitor/dias.js";
import { listarIncidencias } from "../../../services/reportesFv/monitor/incidencias.service.js";
import { exportaMasDeLoQueGenera } from "../../../services/reportesFv/monitor/medidor.js";
import { requirePermission, type McpUser } from "../context.js";
import { campos, texto } from "../format.js";

const r1 = (n: number) => Math.round(n * 10) / 10;
const kwh = (n: number | null | undefined) => (n == null ? "—" : `${r1(n)}`);
const ddmm = (d: Dia) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const diaSchema = z.string().refine(esDiaValido, "Fecha AAAA-MM-DD");

interface PlantaDelProyecto {
  projectId: string;
  cliente: string;
  kwp: number | null;
  kwpFuente: string | null;
  marca: "GROWATT" | "HUAWEI" | null;
  growatt: { plantId: bigint; name: string } | null;
  huawei: { plantCode: string; name: string; capacityKwp: number | null } | null;
}

async function plantaDe(projectId: string): Promise<PlantaDelProyecto | null> {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      clientName: true,
      capacityKwp: true,
      reporteFvConfig: { select: { potenciaInstaladaKwp: true } },
      growattPlant: { select: { plantId: true, name: true, ignorada: true } },
      huaweiPlant: { select: { plantCode: true, name: true, capacityKwp: true, ignorada: true } },
    },
  });
  if (!p) return null;
  const override = p.reporteFvConfig?.potenciaInstaladaKwp;
  const gw = p.growattPlant && !p.growattPlant.ignorada ? { plantId: p.growattPlant.plantId, name: p.growattPlant.name } : null;
  const hw = p.huaweiPlant && !p.huaweiPlant.ignorada ? p.huaweiPlant : null;
  const kwp = override != null ? Number(override) : p.capacityKwp != null ? Number(p.capacityKwp) : null;
  return {
    projectId: p.id,
    cliente: p.clientName,
    kwp: kwp && kwp > 0 ? kwp : null,
    kwpFuente: override != null ? "config del reporte FV" : "ficha del proyecto",
    marca: gw ? "GROWATT" : hw ? "HUAWEI" : null,
    growatt: gw,
    huawei: hw ? { plantCode: hw.plantCode, name: hw.name, capacityKwp: hw.capacityKwp != null ? Number(hw.capacityKwp) : null } : null,
  };
}

const SIN_PLANTA = (id: string) =>
  texto(`El proyecto ${id} no tiene una planta de Growatt ni de Huawei vinculada en Voltia PM, así que no hay datos de monitoreo.`);

/** Mediana de kWh/kWp por día de toda la cartera (menos el proyecto), para comparar. */
async function medianaCartera(desde: Dia, hasta: Dia, excepto: string): Promise<Map<Dia, { mediana: number; n: number }>> {
  const filas = await prisma.$queryRaw<Array<{ fecha: Date; mediana: number; n: bigint }>>(Prisma.sql`
    SELECT g.fecha,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY g."generacionKwh" / COALESCE(c."potenciaInstaladaKwp", p."capacityKwp"))::float AS mediana,
           count(*) AS n
      FROM reporte_fv_generaciones_diarias g
      JOIN projects p ON p.id = g."projectId"
      LEFT JOIN reporte_fv_configs c ON c."projectId" = p.id
     WHERE g.fecha BETWEEN ${diaADate(desde)} AND ${diaADate(hasta)}
       AND g."projectId" <> ${excepto}
       AND g."generacionKwh" > 0
       AND COALESCE(c."potenciaInstaladaKwp", p."capacityKwp") > 0
     GROUP BY g.fecha`);
  return new Map(filas.map((f) => [dateADia(f.fecha), { mediana: f.mediana, n: Number(f.n) }]));
}

export function registerPlantasTools(server: McpServer, user: McpUser) {
  // ─── Generación día por día ──────────────────────────────────────────────
  server.registerTool(
    "generacion_planta",
    {
      title: "Generación de la planta día por día",
      description:
        "Generación, exportación, consumo y compra a la red de cada día de una planta " +
        "(Growatt o Huawei), con el rendimiento en kWh por kWp comparado con la mediana " +
        "del resto de la cartera ese mismo día (mismo sol). Marca los días imposibles " +
        "(exporta más de lo que genera = medidor al revés o mal conectado) y los días que " +
        "rinde muy por debajo de la cartera. Es el primer paso para analizar 'algo raro' " +
        "en una planta. project_id sale de buscar_generador o buscar_proyecto.",
      inputSchema: {
        project_id: z.string().min(1),
        hasta: diaSchema.optional().describe("Último día (AAAA-MM-DD). Por defecto, hoy."),
        dias: z.number().int().min(1).max(120).optional().describe("Cuántos días hacia atrás (por defecto 30)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, hasta, dias }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);
      const pl = await plantaDe(project_id);
      if (!pl) return texto(`No encontré el proyecto ${project_id}.`);
      const fin = hasta ?? hoyUy();
      const ini = sumarDias(fin, -((dias ?? 30) - 1));

      const filas = await prisma.reporteFvGeneracionDiaria.findMany({
        where: { projectId: project_id, fecha: { gte: diaADate(ini), lte: diaADate(fin) } },
        orderBy: { fecha: "asc" },
      });
      if (!filas.length) {
        return pl.marca ? texto(`${pl.cliente}: no hay generación guardada entre ${ddmm(ini)} y ${ddmm(fin)}.`) : SIN_PLANTA(project_id);
      }
      const cartera = await medianaCartera(ini, fin, project_id);

      let genTot = 0, expTot = 0, rendTot = 0, carTot = 0, nComp = 0;
      const imposibles: Dia[] = [];
      const bajos: Dia[] = [];
      const lineas = filas.map((f) => {
        const d = dateADia(f.fecha);
        const gen = Number(f.generacionKwh);
        const exp = f.exportacionKwh != null ? Number(f.exportacionKwh) : null;
        const cons = f.consumoKwh != null ? Number(f.consumoKwh) : null;
        const imp = f.importacionKwh != null ? Number(f.importacionKwh) : null;
        genTot += gen;
        if (exp != null) expTot += exp;
        const marcas: string[] = [];
        if (exportaMasDeLoQueGenera({ generacionKwh: gen, exportacionKwh: exp })) {
          marcas.push("⚠️ exporta más de lo que genera");
          imposibles.push(d);
        }
        let rend = "";
        const c = cartera.get(d);
        if (pl.kwp) {
          const r = gen / pl.kwp;
          rend = ` · ${r.toFixed(2)} kWh/kWp`;
          if (c && c.n >= 5) {
            rend += ` (cartera ${c.mediana.toFixed(2)})`;
            rendTot += r; carTot += c.mediana; nComp++;
            if (c.mediana > 1.5 && r < c.mediana * 0.7) {
              marcas.push(`⚠️ rinde ${Math.round((1 - r / c.mediana) * 100)} % menos que la cartera`);
              bajos.push(d);
            }
          }
        }
        if (d === hoyUy()) marcas.push("(día en curso, incompleto)");
        else if (gen === 0) marcas.push("⚠️ no generó");
        return (
          `${ddmm(d)}: genera ${kwh(gen)}${rend} · exporta ${kwh(exp)} · consumo ${kwh(cons)} · compra ${kwh(imp)}` +
          (marcas.length ? `  ${marcas.join(" · ")}` : "")
        );
      });

      const resumen = campos([
        ["Marca", pl.marca ?? "sin planta vinculada"],
        ["Planta", pl.growatt?.name ?? pl.huawei?.name],
        ["Potencia", pl.kwp ? `${pl.kwp} kWp (${pl.kwpFuente})` : "sin potencia cargada: no se puede comparar con la cartera"],
        ["Potencia según Huawei", pl.huawei?.capacityKwp ? `${pl.huawei.capacityKwp} kWp` : null],
        ["Total del período", `genera ${kwh(genTot)} kWh · exporta ${kwh(expTot)} kWh`],
        ["Rendimiento contra la cartera", nComp ? `${Math.round((rendTot / carTot) * 100)} % de la mediana (${nComp} días comparados)` : null],
        ["Días imposibles (exporta > genera)", imposibles.length ? `${imposibles.length}: ${imposibles.map(ddmm).join(", ")}` : "ninguno"],
        ["Días muy por debajo de la cartera", bajos.length ? `${bajos.length}: ${bajos.map(ddmm).join(", ")}` : "ninguno"],
      ]);

      return texto(
        `${pl.cliente} — ${ddmm(ini)} al ${ddmm(fin)}`,
        resumen,
        "DÍA POR DÍA (kWh)\n" + lineas.join("\n"),
        "Cómo leerlo: '—' es que ese día no se midió (no es cero). La cartera es la mediana de " +
          "kWh/kWp del resto de las plantas ese día: un día nublado baja para todos. Si la potencia " +
          "cargada está mal, el rendimiento sale mal: confirmar paneles × potencia del panel. " +
          "Para ver la forma del día (cortes, sombras) usar curva_horaria; para el medidor y los " +
          "strings ahora mismo, estado_en_vivo.",
      );
    },
  );

  // ─── Curva por hora ──────────────────────────────────────────────────────
  server.registerTool(
    "curva_horaria",
    {
      title: "Curva de un día, hora por hora",
      description:
        "Generación, consumo, compra y exportación de una planta hora por hora en un día. " +
        "Sirve para ver la forma: sombras a cierta hora, cortes, exportación de noche (imposible: " +
        "medidor al revés). Growatt trae el día cada 5 minutos (con detalle_5_min se ven todos los " +
        "puntos); Huawei solo hora por hora y solo generación y exportación.",
      inputSchema: {
        project_id: z.string().min(1),
        dia: diaSchema.describe("AAAA-MM-DD"),
        detalle_5_min: z.boolean().optional().describe("Solo Growatt: devolver todos los puntos de 5 minutos"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, dia, detalle_5_min }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);
      const pl = await plantaDe(project_id);
      if (!pl) return texto(`No encontré el proyecto ${project_id}.`);
      if (!pl.marca) return SIN_PLANTA(project_id);

      if (pl.marca === "HUAWEI") {
        let data: any[];
        try {
          const r = await pedirHuawei("/thirdData/getKpiStationHour", {
            stationCodes: pl.huawei!.plantCode,
            collectTime: new Date(`${dia}T12:00:00-03:00`).getTime(),
          });
          data = r.data ?? [];
        } catch (e) {
          return texto(`Huawei no respondió (${e instanceof Error ? e.message : e}). Probar de nuevo en un rato.`);
        }
        const horas = data
          .map((x) => ({
            h: new Date(x.collectTime - 3 * 3600e3).toISOString().slice(11, 13),
            gen: x.dataItemMap?.inverter_power ?? null,
            exp: x.dataItemMap?.ongrid_power ?? null,
          }))
          .sort((a, b) => a.h.localeCompare(b.h));
        if (!horas.length) return texto(`${pl.cliente}: Huawei no tiene datos por hora del ${ddmm(dia)}.`);
        const nocturnas = horas.filter((h) => (h.gen ?? 0) < 0.05 && (h.exp ?? 0) > 0.3);
        const gen = horas.reduce((s, h) => s + (h.gen ?? 0), 0);
        const exp = horas.reduce((s, h) => s + (h.exp ?? 0), 0);
        return texto(
          `${pl.cliente} — ${ddmm(dia)} (Huawei, kWh por hora, hora de Uruguay)`,
          campos([
            ["Total", `genera ${kwh(gen)} kWh · exporta ${kwh(exp)} kWh`],
            [
              "⚠️ Exporta sin generar",
              nocturnas.length
                ? `${nocturnas.length} horas (${nocturnas.map((h) => `${h.h} h`).join(", ")}): imposible, el medidor está contando la compra como exportación`
                : null,
            ],
          ]),
          horas.map((h) => `${h.h}:00  genera ${kwh(h.gen)} · exporta ${kwh(h.exp)}`).join("\n"),
          "Huawei no da el consumo ni la compra por hora por esta vía. Para comparar la forma del día " +
            "con otra planta del mismo día, pedir su curva_horaria.",
        );
      }

      const c = await obtenerCurvaDia(project_id, dia);
      if (!c.disponible) return texto(`${pl.cliente}: ${c.motivo ?? "no hay curva para ese día"}`);
      const conMedidor = c.origenMedicion != null;

      // Por hora: kWh = suma de W × 5 min.
      const porHora = new Map<string, { gen: number; cons: number; de: number; a: number; max: number; min: number; n: number }>();
      for (const p of c.puntos as any[]) {
        const h = String(p.h).slice(0, 2);
        const acc = porHora.get(h) ?? { gen: 0, cons: 0, de: 0, a: 0, max: 0, min: Infinity, n: 0 };
        const k = 5 / 60 / 1000;
        acc.gen += (p.gen ?? 0) * k;
        acc.cons += (p.consumo ?? 0) * k;
        acc.de += (p.deRed ?? 0) * k;
        acc.a += (p.aRed ?? 0) * k;
        acc.max = Math.max(acc.max, p.gen ?? 0);
        acc.min = Math.min(acc.min, p.gen ?? 0);
        acc.n++;
        porHora.set(h, acc);
      }
      const horas = [...porHora.entries()].sort(([a], [b]) => a.localeCompare(b));
      const nocturnas = conMedidor
        ? (c.puntos as any[]).filter((p) => (p.gen ?? 0) < 20 && (p.aRed ?? 0) > 200)
        : [];
      const consumoCeroNoche = conMedidor
        ? (c.puntos as any[]).filter((p) => (p.gen ?? 0) < 20 && p.consumo === 0).length
        : 0;

      const lineas = horas.map(([h, v]) => {
        const base = `${h}:00  genera ${kwh(v.gen)} (pico ${Math.round(v.max)} W, mínimo ${v.min === Infinity ? "—" : Math.round(v.min)} W)`;
        return conMedidor ? `${base} · consumo ${kwh(v.cons)} · compra ${kwh(v.de)} · exporta ${kwh(v.a)}` : base;
      });

      const bloques = [
        `${pl.cliente} — ${ddmm(dia)} (Growatt, kWh por hora, hora de Uruguay)`,
        campos([
          ["Totales del día", `genera ${kwh(c.resumen.generacionKwh)} · consumo ${kwh(c.resumen.consumoKwh)} · compra ${kwh(c.resumen.importacionKwh)} · exporta ${kwh(c.resumen.exportacionKwh)}`],
          ["Medición de consumo", conMedidor ? (c.origenMedicion === "INVERSOR" ? "medidor conectado al inversor (curva completa)" : "medidor aparte (menos fino)") : "sin medidor: solo generación"],
          ["Día completo", c.completo ? "sí" : "no, es el día en curso"],
          ["⚠️ Exporta sin generar", nocturnas.length ? `${nocturnas.length} puntos de 5 min: imposible, el medidor está al revés o mal conectado` : null],
          ["⚠️ Consumo cero sin sol", consumoCeroNoche > 12 ? `${consumoCeroNoche} puntos de 5 min: una casa nunca consume cero; el medidor no está midiendo la casa` : null],
        ]),
        lineas.join("\n"),
        "El pico y el mínimo de cada hora muestran los cortes: en un día despejado la generación sube y " +
          "baja pareja. Cortes que se repiten a la misma hora todos los días son sombra; cortes al azar " +
          "en un día que en otras plantas fue despejado apuntan al inversor o a la limitación de inyección.",
      ];
      if (detalle_5_min) {
        bloques.push(
          "CADA 5 MINUTOS (W): hora · genera · consumo · compra · exporta\n" +
            (c.puntos as any[]).map((p) => `${p.h} · ${p.gen ?? "—"} · ${p.consumo ?? "—"} · ${p.deRed ?? "—"} · ${p.aRed ?? "—"}`).join("\n"),
        );
      }
      return texto(...bloques);
    },
  );

  // ─── Inversor y medidor en vivo ──────────────────────────────────────────
  server.registerTool(
    "estado_en_vivo",
    {
      title: "Inversor y medidor ahora mismo",
      description:
        "Lectura en vivo del inversor (potencia, voltaje y corriente por fase, cada string con su " +
        "voltaje y corriente, temperatura, fallas) y del medidor (potencia por fase, compra/exporta). " +
        "Compara fase por fase lo que manda el inversor con lo que marca el medidor y avisa lo " +
        "imposible (exportar por una fase más de lo que el inversor le manda = transformador de " +
        "corriente dado vuelta o en otra fase). Para confirmar un medidor invertido conviene pedirla " +
        "varias veces, o de noche (sin sol, todas las fases tienen que marcar compra). Solo el momento " +
        "actual: no hay historial de esta lectura.",
      inputSchema: { project_id: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);
      const pl = await plantaDe(project_id);
      if (!pl) return texto(`No encontré el proyecto ${project_id}.`);
      if (!pl.marca) return SIN_PLANTA(project_id);
      try {
        return pl.marca === "HUAWEI" ? await vivoHuawei(pl) : await vivoGrowatt(pl);
      } catch (e) {
        return texto(`${pl.cliente}: no se pudo leer el equipo (${e instanceof Error ? e.message : e}). Probar de nuevo en un rato.`);
      }
    },
  );

  // ─── Incidencias del monitoreo ───────────────────────────────────────────
  server.registerTool(
    "incidencias_plantas",
    {
      title: "Incidencias del monitoreo de plantas",
      description:
        "Lo que detectó el monitoreo diario: plantas que no generan, sin comunicación, con falla " +
        "del equipo, que no inyectan a la red o con el medidor midiendo al revés. Por defecto las " +
        "abiertas de toda la cartera; con project_id, el historial de una planta.",
      inputSchema: {
        project_id: z.string().optional(),
        estado: z.nativeEnum(FvIncidenciaEstado).optional().describe("ABIERTA (por defecto sin project_id), RESUELTA o DESCARTADA"),
        diagnostico: z.nativeEnum(FvDiagnostico).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ project_id, estado, diagnostico }) => {
      await requirePermission(user, Module.EXPERIENCIA_CLIENTES, Action.VIEW);
      const filas = await listarIncidencias({
        projectId: project_id,
        estado: estado ?? (project_id ? undefined : FvIncidenciaEstado.ABIERTA),
        diagnostico,
        limit: 100,
      });
      if (!filas.length) return texto("No hay incidencias con ese filtro.");
      return texto(
        `${filas.length} incidencia${filas.length === 1 ? "" : "s"}`,
        filas
          .map(
            (i) =>
              `- ${i.clientName ?? i.plantName} (${i.marca}, project_id ${i.projectId ?? "—"}) · ` +
              `${DIAGNOSTICO_LABEL[i.diagnostico]} · ${i.estado.toLowerCase()} · desde ${ddmm(i.primeraDeteccionEn)}` +
              `${i.resueltaEn ? ` hasta ${ddmm(i.resueltaEn)}` : ""} · ${i.diasAfectados} día${i.diasAfectados === 1 ? "" : "s"}` +
              `${i.revisada ? ` · revisada por ${i.revisadaPor ?? "alguien"}` : ""}` +
              `${i.detalle ? `\n  ${i.detalle}` : ""}${i.nota ? `\n  Nota: ${i.nota}` : ""}`,
          )
          .join("\n"),
      );
    },
  );
}

// ─── Lecturas en vivo por marca ──────────────────────────────────────────────

const FASES = ["A", "B", "C"] as const;

/** Lo que dice el último unifilar: contra eso se compara lo que se ve en el equipo. */
async function resumenUnifilar(projectId: string): Promise<string | null> {
  const u = await prisma.unifilarVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, cantidadPaneles: true, potenciaPanelW: true, cantidadStrings: true, modeloInversor: true, potenciaInversorKw: true },
  });
  if (!u) return "Según el unifilar: la obra no tiene unifilar cargado.";
  const paneles = u.cantidadPaneles != null ? Number(u.cantidadPaneles) : null;
  const w = u.potenciaPanelW != null ? Number(u.potenciaPanelW) : null;
  const strings = u.cantidadStrings != null ? Number(u.cantidadStrings) : null;
  return (
    `Según el unifilar (v${u.versionNumber}): ` +
    [
      paneles && w ? `${paneles} paneles de ${w} W = ${r1((paneles * w) / 1000)} kWp` : null,
      strings ? `${strings} string${strings === 1 ? "" : "s"}${paneles ? ` (~${Math.round(paneles / strings)} paneles por string)` : ""}` : null,
      u.modeloInversor ? `inversor ${u.modeloInversor}${u.potenciaInversorKw ? ` (${Number(u.potenciaInversorKw)} kW)` : ""}` : null,
    ]
      .filter(Boolean)
      .join(" · ") +
    ". Si el equipo muestra otra cosa (otro modelo, más o menos strings, voltajes que no cierran con los paneles por string), la obra quedó distinta al unifilar o hay paneles que no aportan."
  );
}

async function vivoHuawei(pl: PlantaDelProyecto) {
  const devs: any[] = (await pedirHuawei("/thirdData/getDevList", { stationCodes: pl.huawei!.plantCode })).data ?? [];
  const inversoresIds = devs.filter((d) => d.devTypeId === 1).map((d) => d.id);
  const medidoresIds = devs.filter((d) => d.devTypeId === 47).map((d) => d.id);
  if (!inversoresIds.length) return texto(`${pl.cliente}: Huawei no lista inversores en esta planta.`);

  await huaweiPausa();
  const invs: any[] = (await pedirHuawei("/thirdData/getDevRealKpi", { devIds: inversoresIds.join(","), devTypeId: 1 })).data ?? [];
  let meds: any[] = [];
  if (medidoresIds.length) {
    await huaweiPausa();
    meds = (await pedirHuawei("/thirdData/getDevRealKpi", { devIds: medidoresIds.join(","), devTypeId: 47 })).data ?? [];
  }

  // Un inversor que se cambió de dongle aparece dos veces: la entrada vieja viene toda en null.
  const vivos = invs.filter((i) => i.dataItemMap && i.dataItemMap.run_state != null && i.dataItemMap.active_power != null);
  const bloques: string[] = [`${pl.cliente} — en vivo (Huawei), ${new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16)} hora de Uruguay`];
  const segunUnifilar = await resumenUnifilar(pl.projectId);
  if (segunUnifilar) bloques.push(segunUnifilar);
  const avisos: string[] = [];
  const porFaseInv: Record<string, number> = { A: 0, B: 0, C: 0 };

  if (!vivos.length) {
    bloques.push("El inversor no está reportando ahora (sin conexión a internet o apagado). Datos de los inversores: todos vacíos.");
  }
  for (const i of vivos) {
    const m = i.dataItemMap;
    const strings: string[] = [];
    const corrientes: number[] = [];
    for (let n = 1; n <= 36; n++) {
      const u = m[`pv${n}_u`], c = m[`pv${n}_i`];
      if (u == null && c == null) continue;
      if (!u && !c) continue;
      strings.push(`PV${n}: ${r1(u ?? 0)} V · ${r1(c ?? 0)} A · ${Math.round((u ?? 0) * (c ?? 0))} W`);
      corrientes.push(c ?? 0);
    }
    const fases = FASES.map((f) => {
      const u = m[`${f.toLowerCase()}_u`], c = m[`${f.toLowerCase()}_i`];
      const w = (u ?? 0) * (c ?? 0);
      porFaseInv[f] += w;
      return `Fase ${f}: ${r1(u ?? 0)} V · ${r1(c ?? 0)} A (~${Math.round(w)} W)`;
    });
    // Huawei da el voltaje por MPPT: dos entradas del mismo MPPT muestran el
    // mismo voltaje. Una entrada en 0 A con el voltaje de otra que sí produce
    // suele ser una entrada que no se usa, no un string caído.
    const maxI = Math.max(0, ...corrientes);
    const voltajes = strings.map((t) => Number(t.split(" ")[1]));
    const enCero = strings
      .map((t, k) => ({ t, k }))
      .filter(({ k }) => corrientes[k] < 0.2);
    for (const { t, k } of enCero) {
      if (maxI <= 2) break;
      const comparte = voltajes.some((v, j) => j !== k && corrientes[j] > 1 && Math.abs(v - voltajes[k]) < 1);
      const nombre = t.split(":")[0];
      avisos.push(
        comparte
          ? `${nombre} sin corriente, en un MPPT compartido con otro string que sí produce: puede ser una entrada que no se usa. Confirmar con el unifilar cuántos strings tiene la planta.`
          : `${nombre} con voltaje y sin corriente mientras otros sí aportan: string desconectado, fusible, conector o sombra total.`,
      );
    }
    bloques.push(
      campos([
        ["Inversor", `${i.sn ?? i.devId}`],
        ["Estado", m.run_state === 1 ? "conectado" : `run_state ${m.run_state}`],
        ["Potencia", `${r1(m.active_power ?? 0)} kW (de los strings: ${r1(m.mppt_power ?? 0)} kW)`],
        ["Generado hoy", `${r1(m.day_cap ?? 0)} kWh`],
        ["Temperatura", m.temperature != null ? `${r1(m.temperature)} °C` : null],
        ["Eficiencia", m.efficiency != null ? `${r1(m.efficiency)} %` : null],
        ["Frecuencia", m.elec_freq != null ? `${m.elec_freq} Hz` : null],
      ]) +
        "\nSalida por fase:\n" + fases.join("\n") +
        (strings.length ? "\nStrings (entradas de paneles):\n" + strings.join("\n") : ""),
    );
  }

  for (const md of meds) {
    const m = md.dataItemMap ?? {};
    if (m.active_power == null) {
      bloques.push("Medidor: no reporta ahora.");
      continue;
    }
    // Convención de Huawei: positivo = hacia la red (exporta), negativo = compra.
    const pf = { A: m.active_power_a, B: m.active_power_b, C: m.active_power_c } as Record<string, number | null>;
    const lineas = FASES.map((f) => {
      const w = pf[f];
      if (w == null) return `Fase ${f}: sin dato`;
      const inv = porFaseInv[f];
      if (vivos.length && w > inv * 1.1 + 300) {
        avisos.push(`Fase ${f}: el medidor marca que exporta ${Math.round(w)} W y el inversor le manda solo ${Math.round(inv)} W. Imposible: el transformador de corriente de la fase ${f} está dado vuelta o puesto en el cable de otra fase.`);
      }
      return `Fase ${f}: ${w >= 0 ? "exporta" : "compra"} ${Math.abs(Math.round(w))} W`;
    });
    const sinSol = vivos.every((i) => (i.dataItemMap.active_power ?? 0) < 0.05);
    if (sinSol) {
      const exportando = FASES.filter((f) => (pf[f] ?? 0) > 100);
      if (exportando.length) avisos.push(`Sin generación y el medidor marca exportación en la fase ${exportando.join(", ")}: imposible, ese transformador está dado vuelta.`);
    }
    bloques.push(
      `Medidor (positivo = exporta a la red; negativo = compra)\n` +
        campos([
          ["Total", `${(m.active_power ?? 0) >= 0 ? "exporta" : "compra"} ${Math.abs(Math.round(m.active_power))} W`],
          ["Factor de potencia", m.power_factor],
          ["Voltajes", `${r1(m.meter_u ?? 0)} / ${r1(m.b_u ?? 0)} / ${r1(m.c_u ?? 0)} V`],
          ["Corrientes", `${r1(m.meter_i ?? 0)} / ${r1(m.b_i ?? 0)} / ${r1(m.c_i ?? 0)} A`],
          ["Acumulado exportado", m.reverse_active_cap != null ? `${r1(m.reverse_active_cap)} kWh` : null],
          ["Acumulado comprado", m.active_cap != null ? `${r1(m.active_cap)} kWh` : null],
        ]) +
        "\n" + lineas.join("\n"),
    );
  }
  if (!meds.length) bloques.push("Esta planta no tiene medidor registrado en Huawei: no hay consumo ni exportación medidos.");

  bloques.push(avisos.length ? "⚠️ AVISOS\n" + avisos.map((a) => `- ${a}`).join("\n") : "Sin incoherencias en esta lectura.");
  bloques.push(
    "Una sola lectura puede engañar (la casa consume justo lo que manda el inversor en una fase). " +
      "Para confirmar, repetir en unos minutos o de noche. Huawei a veces no responde: reintentar.",
  );
  return texto(...bloques);
}

async function vivoGrowatt(pl: PlantaDelProyecto) {
  const devices = await prisma.growattDevice.findMany({
    where: { growattPlantId: pl.growatt!.plantId },
    select: { deviceSn: true, tipo: true, model: true },
  });
  const tlx = devices.filter((d) => d.tipo === 7);
  // Los MAX no tienen lectura en vivo en la Open API: se toma el último
  // registro del historial de hoy de la web (cada ~5 minutos).
  const max = webConfigurada() ? devices.filter((d) => d.tipo === 4) : [];
  if (!tlx.length && !max.length) {
    const tipos = [...new Set(devices.map((d) => d.tipo))].join(", ") || "ninguno";
    return texto(
      `${pl.cliente}: la lectura en vivo por esta vía solo está para inversores Growatt MIN/TLX y MAX, y esta planta no tiene ninguno (tipos de equipo: ${tipos}). ` +
        `Usar curva_horaria para el día de hoy.`,
    );
  }
  const bloques: string[] = [`${pl.cliente} — en vivo (Growatt)`];
  const segunUnifilar = await resumenUnifilar(pl.projectId);
  if (segunUnifilar) bloques.push(segunUnifilar);
  const avisos: string[] = [];
  for (const d of tlx) {
    const raw = await growattPostCrudo("device/tlx/tlx_last_data", { tlx_sn: d.deviceSn });
    const m = raw?.tlx ?? raw?.data ?? raw;
    if (!m || typeof m !== "object") {
      bloques.push(`Inversor ${d.deviceSn}: Growatt no devolvió datos.`);
      continue;
    }
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const strings: string[] = [];
    const corrientes: number[] = [];
    for (let k = 1; k <= 8; k++) {
      const u = n(m[`vpv${k}`]), c = n(m[`ipv${k}`]);
      if (!u && !c) continue;
      strings.push(`PV${k}: ${r1(u)} V · ${r1(c)} A · ${Math.round(n(m[`ppv${k}`]) || u * c)} W`);
      corrientes.push(c);
    }
    const fases = [1, 2, 3]
      .filter((k) => n(m[`vac${k}`]) > 0)
      .map((k) => `Fase ${k}: ${r1(n(m[`vac${k}`]))} V · ${r1(n(m[`iac${k}`]))} A · ${Math.round(n(m[`pac${k}`]))} W`);
    const pac = n(m.pac);
    const aRed = n(m.pacToGridTotal);
    const deRed = n(m.pacToUserTotal);
    const cons = n(m.pacToLocalLoad);
    const tieneMedidor = aRed > 0 || deRed > 0 || cons > 0 || n(m.etoGridToday) > 0 || n(m.etoUserToday) > 0;
    if (tieneMedidor && aRed > pac * 1.1 + 300) avisos.push(`El medidor marca que exporta ${Math.round(aRed)} W y el inversor genera ${Math.round(pac)} W: imposible, el medidor está al revés o mal conectado.`);
    if (tieneMedidor && n(m.etoGridToday) > n(m.eacToday) + 2) avisos.push(`Hoy figura exportando ${r1(n(m.etoGridToday))} kWh habiendo generado ${r1(n(m.eacToday))} kWh: imposible, medidor al revés.`);
    const maxI = Math.max(0, ...corrientes);
    const enCero = strings.filter((_, k) => corrientes[k] < 0.2);
    if (maxI > 2 && enCero.length) avisos.push(`String(s) con voltaje y sin corriente mientras otros sí aportan: ${enCero.map((s) => s.split(":")[0]).join(", ")}.`);
    if (m.errorText && String(m.errorText).toLowerCase() !== "unknown") avisos.push(`Falla del inversor: ${m.errorText}`);
    if (m.warnText && String(m.warnText).toLowerCase() !== "unknown") avisos.push(`Advertencia del inversor: ${m.warnText}`);
    bloques.push(
      campos([
        ["Inversor", `${d.deviceSn}${d.model ? ` (${d.model})` : ""}`],
        ["Último dato", m.time ? `${m.time} (hora de la planta)` : null],
        ["Estado", m.statusText ?? null],
        ["Growatt ve el equipo", m.lost === true ? "no (de noche es normal: el datalogger se apaga sin sol)" : "sí"],
        ["Potencia", `${Math.round(pac)} W (de los strings: ${Math.round(n(m.ppv))} W)`],
        ["Generado hoy", `${r1(n(m.eacToday))} kWh`],
        ["Temperatura", m.temp1 != null ? `${r1(n(m.temp1))} °C` : null],
        ["Medidor ahora", tieneMedidor ? `consumo ${Math.round(cons)} W · compra ${Math.round(deRed)} W · exporta ${Math.round(aRed)} W` : "sin medidor conectado al inversor"],
        ["Medidor hoy", tieneMedidor ? `consumo ${r1(n(m.elocalLoadToday))} · compra ${r1(n(m.etoUserToday))} · exporta ${r1(n(m.etoGridToday))} kWh` : null],
      ]) +
        (fases.length ? "\nSalida por fase:\n" + fases.join("\n") : "") +
        (strings.length ? "\nStrings (entradas de paneles):\n" + strings.join("\n") : ""),
    );
  }
  for (const d of max) {
    let ult: RegistroInversor | undefined;
    try {
      ult = (await historialInversor(d.deviceSn, 4, hoyUy(), hoyUy())).at(-1);
    } catch (e) {
      bloques.push(`Inversor ${d.deviceSn}: no se pudo leer (${e instanceof Error ? e.message : e}).`);
      continue;
    }
    if (!ult) {
      bloques.push(`Inversor ${d.deviceSn}${d.model ? ` (${d.model})` : ""}: hoy todavía no mandó ningún dato (de noche es normal).`);
      continue;
    }
    const entradas = ult.vpv
      .map((v, k) => ({ k, v: v ?? 0, i: ult!.ipv[k] ?? 0 }))
      .filter((x) => x.v > 0.5 || x.i > 0.1)
      .map((x) => `PV${x.k + 1}: ${r1(x.v)} V · ${r1(x.i)} A`);
    const strs = ult.iString.map((c, k) => ({ k, c: c ?? 0 })).filter((x) => x.c > 0.05).map((x) => `S${x.k + 1}: ${r1(x.c)} A`);
    const conTension = ult.vpv.some((v) => (v ?? 0) > 150);
    if (ult.status === 3) {
      avisos.push(
        `El inversor ${d.deviceSn} está EN FALLA (código ${ult.faultType ?? "?"})${conTension ? " con los paneles con tensión: hay sol y no genera" : ""}. ` +
          "Ver alarmas_planta para el nombre del código e historial_inversor para desde cuándo.",
      );
    }
    bloques.push(
      campos([
        ["Inversor", `${d.deviceSn}${d.model ? ` (${d.model})` : ""} — MAX/MID/MAC`],
        ["Último dato", `${ult.time} (hora de la planta; llega cada ~5 minutos)`],
        ["Estado", ult.status === 1 ? "generando" : ult.status === 3 ? `en falla (código ${ult.faultType ?? "?"})` : ult.status === 0 ? "en espera" : String(ult.status)],
        ["Potencia", `${Math.round(ult.pac ?? 0)} W (de los paneles: ${Math.round(ult.ppv ?? 0)} W)`],
        ["Generado hoy", `${r1(ult.eacToday ?? 0)} kWh`],
        ["Red", `${r1(ult.vac1 ?? 0)} V · ${r1(ult.fac ?? 0)} Hz`],
        ["Temperatura", ult.temp1 != null ? `${r1(ult.temp1)} °C` : null],
        ["Aislamiento (pvIso)", ult.pvIso ? `${ult.pvIso} kΩ` : null],
        ["Corriente de fuga", ult.gfci != null ? `${ult.gfci} mA` : null],
      ]) +
        (entradas.length ? "\nEntradas de paneles:\n" + entradas.join("\n") : "") +
        (strs.length ? "\nStrings:\n" + strs.join("\n") : ""),
    );
  }
  bloques.push(avisos.length ? "⚠️ AVISOS\n" + avisos.map((a) => `- ${a}`).join("\n") : "Sin incoherencias en esta lectura.");
  bloques.push("Growatt no da el medidor fase por fase por esta vía: para ver la forma del día usar curva_horaria.");
  return texto(...bloques);
}
