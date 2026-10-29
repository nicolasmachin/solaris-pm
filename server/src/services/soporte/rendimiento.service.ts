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

const UMBRAL_BAJO = 0.6;
const UMBRAL_RECUPERADO = 0.8;
const DIA_CON_SOL = 1.0; // kWh/kWp de la mediana

type Fila = { projectId: string; fecha: Date; kwh: number; kwp: number; nombre: string };

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
  /** Últimos días con sol (los más viejos primero), con kWh y "vs. lo normal". */
  ultimos: Array<{ dia: string; kwh: number; vs: number }>;
};

/** El cálculo de arriba, por proyecto. Solo base de datos. */
export async function rendimientoReciente(): Promise<Map<string, RendimientoPlanta>> {
  // Un año y un mes: para tener el mismo mes del año anterior.
  const desde = new Date(Date.now() - 400 * 86_400_000);
  // Hoy no: el día está incompleto y cualquier planta parecería generar poco.
  const hoy = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" })}T00:00:00Z`);
  const filas: Fila[] = (
    await prisma.reporteFvGeneracionDiaria.findMany({
      where: { fecha: { gte: desde, lt: hoy }, project: { deletedAt: null, capacityKwp: { gt: 0.5 } } },
      select: { projectId: true, fecha: true, generacionKwh: true, project: { select: { capacityKwp: true, clientName: true } } },
    })
  ).map((r) => ({
    projectId: r.projectId,
    fecha: r.fecha,
    kwh: Number(r.generacionKwh),
    kwp: Number(r.project.capacityKwp),
    nombre: r.project.clientName,
  }));

  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const porDia = new Map<string, number[]>();
  for (const f of filas) {
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
      .map((f) => ({ ...f, rat: f.kwh / f.kwp / f.med! }))
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
    const ultimos = conCociente
      .filter((f) => f.med! >= DIA_CON_SOL)
      .slice(-3)
      .map((f) => ({ dia: dia(f.fecha), kwh: f.kwh, vs: f.rat / normal }));
    out.set(projectId, { nombre: fs[0].nombre, normal, fuente, ultimos });
  }
  return out;
}

export async function revisarRendimiento(): Promise<{ abiertos: number; cerrados: number }> {
  const porPlanta = await rendimientoReciente();
  let abiertos = 0;
  let cerrados = 0;
  for (const [projectId, r] of porPlanta) {
    // Los días en cero los ve el vigía ("no genera"): acá solo los que generaron.
    const conGen = r.ultimos.filter((u) => u.kwh > 0);
    if (conGen.length < 3) continue;
    const vs = conGen.map((u) => u.vs);
    const ultimo = vs[vs.length - 1];

    if (ultimo >= UMBRAL_RECUPERADO) {
      cerrados += await cerrarAutomatico(projectId, [SoporteCasoTipo.BAJO_RENDIMIENTO], "Volvió a rendir normal.");
      continue;
    }
    if (vs.filter((x) => x < UMBRAL_BAJO).length < 2 || ultimo >= UMBRAL_BAJO) continue;

    const caida = await prisma.soporteCaso.findFirst({
      where: { projectId, estado: "ABIERTO", tipo: { not: SoporteCasoTipo.BAJO_RENDIMIENTO } },
    });
    if (caida) continue; // ya hay un caso de planta caída: es el mismo problema

    const detalleDias = conGen
      .map((u) => `${u.dia.slice(8, 10)}/${u.dia.slice(5, 7)}: ${u.kwh.toFixed(1)} kWh (${Math.round(u.vs * 100)} % de lo normal)`)
      .join(", ");
    const res = await abrirOActualizar({
      projectId,
      tipo: SoporteCasoTipo.BAJO_RENDIMIENTO,
      titulo: "Genera menos de lo normal",
      detalle: `${r.nombre} viene generando por debajo de lo normal para ella, comparada con el resto de la cartera los mismos días: ${detalleDias}. Mirar la curva del día: una meseta es derateo o límite de potencia; arranque tarde a la mañana, aislación; la mitad de lo normal, un string caído.`,
    });
    if (res.nuevo) abiertos++;
  }
  return { abiertos, cerrados };
}
