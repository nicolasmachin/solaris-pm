// Vigía de Soporte: cada media hora con sol mira toda la cartera Growatt.
//
// Costo: `plant/list` trae potencia, energía total y estado de TODAS las
// plantas en 2 llamadas (100 por página). Solo para las que quedan sospechosas
// se pide además el estado del inversor (`tlx_last_data`, una llamada por
// equipo) para leer el código de falla. Medido el 28-oct-2026: 185 plantas
// visibles, ~80 vinculadas a clientes.

import { SoporteCasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { listarPlantas, ultimoDatoInversor } from "../reportesFv/growatt/client.js";
import { abrirOActualizar, cerrarAutomatico, TIPOS_CAIDA, type NuevoCaso } from "./casos.service.js";
import { diagnosticarInversor, type Diagnostico } from "./diagnostico.js";
import { evaluarLectura, medianaCartera, type LecturaPlanta } from "./vigia.js";


const horaUy = (d: Date) =>
  d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Montevideo" });
const diaUy = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });

export type ResultadoVigia = {
  plantas: number;
  mediana: number | null;
  casosNuevos: number;
  casosCerrados: number;
  consultasInversor: number;
};

let corriendo = false;

/**
 * Tope de una vuelta. Cada consulta a Growatt ya tiene 30 s de límite y 5
 * reintentos, pero si hubiera muchas plantas sospechosas a la vez la vuelta
 * corta acá y deja el resto para la siguiente: nunca queda nada colgado ni se
 * pisan dos vueltas.
 */
const TOPE_VUELTA_MS = 10 * 60_000;

export async function correrVigia(ahora = new Date()): Promise<ResultadoVigia> {
  if (corriendo) throw new Error("El vigía ya está corriendo");
  corriendo = true;
  try {
    return await vuelta(ahora);
  } finally {
    corriendo = false;
  }
}

async function vuelta(ahora: Date): Promise<ResultadoVigia> {
  const [growatt, vinculadas] = await Promise.all([
    listarPlantas(),
    prisma.growattPlant.findMany({
      where: { projectId: { not: null }, ignorada: false, project: { deletedAt: null } },
      select: {
        plantId: true,
        projectId: true,
        project: { select: { clientName: true, capacityKwp: true } },
        devices: { select: { deviceSn: true, tipo: true } },
      },
    }),
  ]);
  const porId = new Map(growatt.map((g) => [g.plantId, g]));

  const filas = vinculadas
    .map((v) => {
      const g = porId.get(String(v.plantId));
      if (!g || !v.projectId) return null;
      const kwp = v.project?.capacityKwp != null ? Number(v.project.capacityKwp) : null;
      const lectura: LecturaPlanta = { status: g.statusNum ?? null, potenciaW: g.potenciaW ?? null, kwp };
      return { v, g, lectura, projectId: v.projectId };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const mediana = medianaCartera(filas.map((f) => f.lectura));
  const previos = new Map(
    (await prisma.soporteEstadoPlanta.findMany({ where: { growattPlantId: { in: filas.map((f) => f.v.plantId) } } })).map(
      (e) => [e.growattPlantId, e],
    ),
  );
  const abiertos = new Set(
    (await prisma.soporteCaso.findMany({ where: { estado: "ABIERTO" }, select: { projectId: true } })).map((c) => c.projectId),
  );

  const hoy = diaUy(ahora);
  let casosNuevos = 0;
  let casosCerrados = 0;
  let consultasInversor = 0;

  const inicio = Date.now();
  for (const { v, g, lectura, projectId } of filas) {
    if (Date.now() - inicio > TOPE_VUELTA_MS) {
      console.warn("[soporte] la vuelta pasó los 10 minutos: el resto queda para la próxima");
      break;
    }
    const previo = previos.get(v.plantId);
    const ev = evaluarLectura(
      {
        factorNormal: previo?.factorNormal ?? null,
        ceroConSol: previo?.ceroConSol ?? 0,
        desconectadaConSol: previo?.desconectadaConSol ?? 0,
      },
      lectura,
      mediana,
      // Con un caso abierto no se aprende: si no, "lo normal" bajaría hasta
      // parecerse a la planta rota.
      { aprender: !abiertos.has(projectId) },
    );

    const nuevoDia = !previo?.diaInicio || diaUy(previo.diaInicio) !== hoy;
    const datos = {
      projectId,
      status: lectura.status,
      potenciaW: lectura.potenciaW,
      energiaTotalKwh: g.energiaTotalKwh ?? null,
      energiaInicioDiaKwh: nuevoDia ? g.energiaTotalKwh ?? null : previo!.energiaInicioDiaKwh,
      diaInicio: nuevoDia ? new Date(`${hoy}T00:00:00Z`) : previo!.diaInicio,
      leidoEn: ahora,
      factorNormal: ev.factorNormal,
      ceroConSol: ev.ceroConSol,
      desconectadaConSol: ev.desconectadaConSol,
      ultimaGeneracionEn: ev.genera ? ahora : previo?.ultimaGeneracionEn ?? null,
    };
    await prisma.soporteEstadoPlanta.upsert({
      where: { growattPlantId: v.plantId },
      create: { growattPlantId: v.plantId, ...datos },
      update: datos,
    });

    if (ev.genera) {
      casosCerrados += await cerrarAutomatico(projectId, TIPOS_CAIDA, `Volvió a generar a las ${horaUy(ahora)}.`);
      continue;
    }
    if (!ev.alerta) continue;

    // Con un caso abierto y revisado hace menos de una hora, no se vuelve a
    // preguntar: el aviso ya salió y cada consulta gasta cupo de Growatt.
    const abierto = await prisma.soporteCaso.findFirst({
      where: { projectId, estado: "ABIERTO", tipo: { in: TIPOS_CAIDA } },
      select: { ultimaVezEn: true },
    });
    if (abierto && ahora.getTime() - abierto.ultimaVezEn.getTime() < 60 * 60_000) continue;

    // Se confirma con el último dato de cada inversor (MIN o MAX).
    const diagnosticos: Diagnostico[] = [];
    for (const d of v.devices.filter((d) => d.tipo === 7 || d.tipo === 4)) {
      try {
        consultasInversor++;
        const dato = await ultimoDatoInversor(d.deviceSn, d.tipo);
        if (dato) diagnosticos.push(diagnosticarInversor(dato, ahora));
      } catch (err) {
        console.error(`[soporte] no se pudo leer el inversor ${d.deviceSn}:`, (err as Error).message);
      }
    }
    const peor = elegirPeor(diagnosticos);
    // La lista venía atrasada: el inversor genera. No es un caso.
    if (peor?.tipo === "GENERA") continue;

    const nombre = v.project?.clientName ?? g.name;
    const sol = mediana != null ? ` Mientras tanto la cartera genera al ${Math.round(mediana * 100)} % de su potencia.` : "";
    const desde = await ultimaGeneracion(projectId, previo?.ultimaGeneracionEn ?? null, hoy);

    let caso: NuevoCaso;
    if (peor) {
      caso = {
        projectId,
        growattPlantId: v.plantId,
        tipo: SoporteCasoTipo[peor.tipo],
        titulo: peor.titulo,
        // El último dato del inversor ya dice desde cuándo: no se suma el día.
        detalle: `${nombre}: ${peor.detalle}${sol}${peor.tipo === "SIN_COMUNICACION" ? "" : ` ${desde}`}`.trim(),
        codigoFalla: "codigo" in peor ? peor.codigo : null,
        llaveDelCliente: "llaveDelCliente" in peor ? peor.llaveDelCliente : false,
      };
    } else if (ev.alerta === "SIN_COMUNICACION") {
      caso = {
        projectId,
        growattPlantId: v.plantId,
        tipo: SoporteCasoTipo.SIN_COMUNICACION,
        titulo: "No comunica",
        detalle: `${nombre} está desconectada de Growatt hace más de una hora con sol.${sol} ${desde} Suele ser el wifi de la casa, el datalogger o un corte de luz.`,
      };
    } else {
      caso = {
        projectId,
        growattPlantId: v.plantId,
        tipo: SoporteCasoTipo.SIN_GENERACION,
        titulo: "No genera",
        detalle: `${nombre} figura en línea pero sin generar hace más de una hora, y no se pudo leer el inversor.${sol} ${desde}`,
      };
    }
    const r = await abrirOActualizar(caso);
    if (r.nuevo) casosNuevos++;
  }

  return { plantas: filas.length, mediana, casosNuevos, casosCerrados, consultasInversor };
}

/** Con varios inversores, el problema más grave manda. */
function elegirPeor(ds: Diagnostico[]): Diagnostico | null {
  const orden = ["FALLA_INVERSOR", "SIN_GENERACION", "SIN_COMUNICACION", "GENERA"];
  return [...ds].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo))[0] ?? null;
}

/** "Generó por última vez…": la lectura del vigía, o el último día con generación en la base. */
async function ultimaGeneracion(projectId: string, vista: Date | null, hoy: string): Promise<string> {
  if (vista) {
    const dia = diaUy(vista);
    return `Generó por última vez ${dia === hoy ? "hoy" : `el ${dia.slice(8, 10)}/${dia.slice(5, 7)}`} a las ${horaUy(vista)}.`;
  }
  const ultimo = await prisma.reporteFvGeneracionDiaria.findFirst({
    where: { projectId, generacionKwh: { gt: 0 } },
    orderBy: { fecha: "desc" },
    select: { fecha: true },
  });
  if (!ultimo) return "";
  const d = ultimo.fecha.toISOString().slice(0, 10);
  return `Último día con generación registrada: ${d.slice(8, 10)}/${d.slice(5, 7)}.`;
}
