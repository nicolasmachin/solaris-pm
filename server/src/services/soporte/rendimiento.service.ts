// Bajo rendimiento: la planta genera, pero bastante menos que lo normal PARA
// ELLA. Corre una vez por día sobre la generación diaria que ya está en la base
// (ReporteFvGeneracionDiaria, la carga el monitoreo de las 8): no llama a
// ninguna API.
//
// Método (probado sobre producción el 28-oct-2026, 81 plantas, 30 días):
//   rendimiento del día = kWh / kWp
//   cociente = rendimiento / mediana de la cartera ese día  (el clima se cancela)
//   lo normal de la planta = mediana de sus cocientes del MISMO MES del año
//     anterior (si tiene ≥ 8 días con sol), o si no de los últimos 30 días.
//     Por mes porque el cociente de cada planta cambia con la estación (sol de
//     invierno más bajo, sombras distintas): medido en prod el 28-oct-2026, la
//     mitad de las plantas varía 23 % entre su mejor y su peor mes (Vanoli: 1,50
//     en junio, 0,84 en octubre). Los datos arrancan en junio de 2026: hasta
//     junio de 2027 se usan los últimos 30 días, que siguen la estación.
//   vs normal = cociente / lo normal
// Alerta si en 2 de los últimos 3 días con sol (mediana ≥ 1 kWh/kWp) estuvo por
// debajo del 60 % de lo normal y el último también. Marcó 11 plantas en 30
// días, casi todas con un problema real (Martín González: aislación).
// Los días en cero no cuentan acá: esos son "no genera" y los ve el vigía.

import { SoporteCasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { abrirOActualizar, cerrarAutomatico } from "./casos.service.js";
import { kwpEfectivo } from "./kwp.js";
import { pausasDePlantas } from "./pausas.js";
import { investigarDia } from "./investigar.js";

const UMBRAL_BAJO = 0.6;

const UMBRAL_RECUPERADO = 0.8;
const DIA_CON_SOL = 1.0; // kWh/kWp de la mediana

// kwp null = sin potencia confiable: no entra en la mediana de la cartera, pero
// igual se compara contra sí misma (la potencia se cancela en "vs. lo normal").
type Fila = { projectId: string; fecha: Date; kwh: number; kwp: number | null; nombre: string };

const mediana = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export type RendimientoPlanta = {
  nombre: string;
  /** Cociente normal de la planta respecto de la mediana de la cartera. */
  normal: number;
  /** De dónde salió lo normal. */
  fuente: "MISMO_MES_ANIO_ANTERIOR" | "ULTIMOS_30_DIAS";
  /** Últimos 3 días con sol (los más viejos primero), con kWh y "vs. lo normal". */
  ultimos: Array<{ dia: string; kwh: number; vs: number }>;
  /** Los días con sol de las últimas dos semanas, igual que `ultimos`. */
  quincena: Array<{ dia: string; kwh: number; vs: number }>;
};

/** El cálculo de arriba, por proyecto. Solo base de datos. */
export async function rendimientoReciente(): Promise<Map<string, RendimientoPlanta>> {
  // Un año y un mes: para tener el mismo mes del año anterior.
  const desde = new Date(Date.now() - 400 * 86_400_000);
  // Hoy no: el día está incompleto y cualquier planta parecería generar poco.
  const hoy = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" })}T00:00:00Z`);
  const filas: Fila[] = (
    await prisma.reporteFvGeneracionDiaria.findMany({
      where: { fecha: { gte: desde, lt: hoy }, project: { deletedAt: null } },
      select: {
        projectId: true,
        fecha: true,
        generacionKwh: true,
        project: {
          select: {
            capacityKwp: true,
            clientName: true,
            reporteFvConfig: { select: { potenciaInstaladaKwp: true } },
            growattPlant: { select: { peakPowerKw: true } },
          },
        },
      },
    })
  ).map((r) => ({
    projectId: r.projectId,
    fecha: r.fecha,
    kwh: Number(r.generacionKwh),
    kwp: kwpEfectivo({
      config: r.project.reporteFvConfig?.potenciaInstaladaKwp,
      proyecto: r.project.capacityKwp,
      growatt: r.project.growattPlant?.peakPowerKw,
    }),
    nombre: r.project.clientName,
  }));

  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const porDia = new Map<string, number[]>();
  for (const f of filas) {
    if (f.kwp == null) continue;
    const y = f.kwh / f.kwp;
    if (y > 0.3) porDia.set(dia(f.fecha), [...(porDia.get(dia(f.fecha)) ?? []), y]);
  }
  const medDia = new Map([...porDia].map(([d, ys]) => [d, mediana(ys)!]));

  const porPlanta = new Map<string, Fila[]>();
  for (const f of filas) porPlanta.set(f.projectId, [...(porPlanta.get(f.projectId) ?? []), f]);

  const out = new Map<string, RendimientoPlanta>();
  for (const [projectId, fs] of porPlanta) {
    const conCociente = fs
      .map((f) => ({ ...f, med: medDia.get(dia(f.fecha)) ?? null }))
      .filter((f) => f.med != null)
      // Sin potencia confiable se usa 1: el cociente queda en otra escala pero
      // "vs. lo normal" (cociente / su propia mediana) da lo mismo.
      .map((f) => ({ ...f, rat: f.kwh / (f.kwp ?? 1) / f.med! }))
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const validos = conCociente.filter((f) => f.rat > 0.2 && f.med! >= DIA_CON_SOL);
    // Mismo mes calendario del año anterior.
    const mesAnterior = `${hoy.getUTCFullYear() - 1}-${String(hoy.getUTCMonth() + 1).padStart(2, "0")}`;
    const delMes = validos.filter((f) => dia(f.fecha).startsWith(mesAnterior));
    const hace30 = new Date(hoy.getTime() - 30 * 86_400_000);
    const recientes = validos.filter((f) => f.fecha >= hace30);
    let normal: number | null;
    let fuente: RendimientoPlanta["fuente"];
    if (delMes.length >= 8) {
      normal = mediana(delMes.map((f) => f.rat));
      fuente = "MISMO_MES_ANIO_ANTERIOR";
    } else {
      if (recientes.length < 10) continue;
      normal = mediana(recientes.map((f) => f.rat));
      fuente = "ULTIMOS_30_DIAS";
    }
    if (normal == null) continue;
    const conSol = conCociente
      .filter((f) => f.med! >= DIA_CON_SOL)
      .map((f) => ({ dia: dia(f.fecha), kwh: f.kwh, vs: f.rat / normal! }));
    const hace14 = dia(new Date(hoy.getTime() - 14 * 86_400_000));
    out.set(projectId, {
      nombre: fs[0].nombre,
      normal,
      fuente,
      ultimos: conSol.slice(-3),
      quincena: conSol.filter((d) => d.dia >= hace14),
    });
  }
  return out;
}

export async function revisarRendimiento(): Promise<{ abiertos: number; cerrados: number }> {
  const porPlanta = await rendimientoReciente();
  // En obra (la propia o una ampliación) o silenciada: no se abre "genera menos".
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
  const ids = [...porPlanta.keys()];
  const [g, h] = await Promise.all([
    prisma.growattPlant.findMany({ where: { projectId: { in: ids } }, select: { projectId: true, monitoreoSilenciadoHasta: true } }),
    prisma.huaweiPlant.findMany({ where: { projectId: { in: ids } }, select: { projectId: true, monitoreoSilenciadoHasta: true } }),
  ]);
  const pausas = await pausasDePlantas(ids, hoy, new Map([...g, ...h].map((p) => [p.projectId!, p.monitoreoSilenciadoHasta])));
  let abiertos = 0;
  let cerrados = 0;
  const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const pct = (v: number) => `${Math.round(v * 100)} %`;

  // Con UN día rojo alcanza (criterio de Nicolás, 28-oct-2026): se va a mirar
  // el inversor ese día y la planta queda a la vista. No se espera a que se
  // acumulen días: las fallas que vienen y van (Martín González) se escapan.
  for (const [projectId, r] of porPlanta) {
    const dias = r.quincena;
    const ultimo = dias[dias.length - 1];
    if (!ultimo) continue;
    const abierto = await prisma.soporteCaso.findFirst({
      where: { projectId, estado: "ABIERTO", tipo: SoporteCasoTipo.BAJO_RENDIMIENTO },
    });

    if (ultimo.vs >= UMBRAL_RECUPERADO) {
      // Se cierra solo con 3 días con sol seguidos normales (y si no se repite).
      const tres = dias.slice(-3);
      if (abierto && !abierto.recurrente && tres.length === 3 && tres.every((d) => d.vs >= UMBRAL_RECUPERADO)) {
        cerrados += await cerrarAutomatico(projectId, [SoporteCasoTipo.BAJO_RENDIMIENTO], "Rindió normal 3 días con sol seguidos.");
      }
      continue;
    }
    // Rojo: menos del 60 % de lo normal, generando algo (el cero es del vigía).
    if (ultimo.vs >= UMBRAL_BAJO || ultimo.kwh <= 0) continue;
    if (pausas.has(projectId)) continue;
    if (abierto?.ultimoDiaRevisado && abierto.ultimoDiaRevisado.toISOString().slice(0, 10) === ultimo.dia) continue;
    const caida = await prisma.soporteCaso.findFirst({
      where: { projectId, estado: "ABIERTO", tipo: { not: SoporteCasoTipo.BAJO_RENDIMIENTO } },
    });
    if (caida) continue; // ya hay un caso de planta caída: es el mismo problema

    const otrosRojos = dias.filter((d) => d.dia !== ultimo.dia && d.vs < UMBRAL_BAJO && d.kwh > 0);
    const seRepite = otrosRojos.length > 0 || !!abierto;
    const cortes = await prisma.fvIncidencia.count({
      where: {
        projectId,
        diagnostico: { in: ["SIN_COMUNICACION", "SIN_DATOS_API"] },
        ultimaDeteccionEn: { gte: new Date(`${ultimo.dia}T00:00:00Z`) },
      },
    });
    const ojo = cortes
      ? " Ojo: ese día la planta también tuvo cortes de comunicación, así que los kWh pueden estar incompletos."
      : "";
    const texto = `El ${ddmm(ultimo.dia)} generó ${ultimo.kwh.toFixed(1)} kWh, el ${pct(ultimo.vs)} de lo normal para ella (con el resto de la cartera como referencia del clima).${
      otrosRojos.length ? ` Ya le pasó en las dos semanas anteriores: ${otrosRojos.map((d) => `${ddmm(d.dia)} (${pct(d.vs)})`).join(", ")}.` : ""
    }${ojo}`;

    let casoId: string;
    if (abierto) {
      casoId = abierto.id;
      await prisma.soporteCaso.update({
        where: { id: abierto.id },
        data: {
          recurrente: true,
          titulo: abierto.titulo.startsWith("Se repite") ? abierto.titulo : "Se repite: genera menos de lo normal",
          detalle: `${abierto.detalle} Otra vez: ${texto}`,
          ultimaVezEn: new Date(),
        },
      });
    } else {
      const res = await abrirOActualizar({
        projectId,
        tipo: SoporteCasoTipo.BAJO_RENDIMIENTO,
        titulo: seRepite ? "Se repite: genera menos de lo normal" : "Genera menos de lo normal (en observación)",
        detalle: `${r.nombre}: ${texto}`,
      });
      casoId = res.id;
      if (res.nuevo) abiertos++;
      if (seRepite) await prisma.soporteCaso.update({ where: { id: casoId }, data: { recurrente: true } });
    }
    await prisma.soporteCaso.update({ where: { id: casoId }, data: { ultimoDiaRevisado: new Date(`${ultimo.dia}T00:00:00Z`) } });
    // Ir a mirar el inversor ese día.
    await investigarDia(casoId, projectId, ultimo.dia);
  }
  return { abiertos, cerrados };
}
