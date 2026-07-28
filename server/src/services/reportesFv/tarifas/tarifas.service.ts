// Tarifas UTE versionadas por vigencia.
//
// UTE ajusta el pliego cada tanto. Si los precios se pisaran, los reportes
// viejos dejarían de reproducirse: por eso cada cuadro es una versión con fecha
// de vigencia, y `ReporteFvCalculo` congela cuál usó.
//
// Ciclo de vida: se crea un BORRADOR (normalmente clonando el vigente), se
// edita, y al PUBLICAR queda inmutable y cierra la vigencia del anterior. Un
// borrador nunca resuelve vigencia, así que se puede preparar el cuadro nuevo
// con tranquilidad sin afectar los cálculos en curso.

import { AuditAction, AuditEntityType, type Prisma, TarifaUte, FranjaHoraria } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { createAuditEntry } from "../../audit.service.js";
import { badRequest, conflict, notFound } from "../../../utils/errors.js";
import { type Periodo, ultimoDiaDelPeriodo } from "../periodo.js";
import type { TarifaKey, TarifaSnapshot } from "../motor/types.js";

// ─── Mapeo enum Prisma ↔ claves del motor ────────────────────────────────────
// El motor usa strings en minúscula (heredados del sistema original, donde eran
// nombres de hoja de Excel). La DB usa el enum. La traducción vive sólo acá.

const TARIFA_A_KEY: Record<TarifaUte, TarifaKey> = {
  [TarifaUte.SIMPLE]: "simple",
  [TarifaUte.DOBLE]: "doble",
  [TarifaUte.TRIPLE]: "triple",
  [TarifaUte.ZAFRAL]: "zafral",
};

export const KEY_A_TARIFA: Record<TarifaKey, TarifaUte> = {
  simple: TarifaUte.SIMPLE,
  doble: TarifaUte.DOBLE,
  triple: TarifaUte.TRIPLE,
  zafral: TarifaUte.ZAFRAL,
};

export function tarifaAKey(t: TarifaUte): TarifaKey {
  return TARIFA_A_KEY[t];
}

const dec = (v: Prisma.Decimal | number): number => Number(v);

// ─── Cache ───────────────────────────────────────────────────────────────────
// Mismo criterio que el cache de permisos: 5 minutos, invalidación explícita al
// publicar. Una corrida mensual resuelve la tarifa una vez por cliente y por
// periodo, así que sin cache serían cientos de queries idénticas.

const CACHE_TTL_MS = 5 * 60 * 1000;
const cacheSnapshots = new Map<string, { snapshot: TarifaSnapshot; expira: number }>();
let cacheVigentes: { versiones: VersionVigencia[]; expira: number } | null = null;

export function clearTarifasCache() {
  cacheSnapshots.clear();
  cacheVigentes = null;
}

interface VersionVigencia {
  id: string;
  nombre: string;
  vigenteDesde: Date;
}

// ─── Resolución de vigencia ──────────────────────────────────────────────────

async function versionesPublicadas(): Promise<VersionVigencia[]> {
  const ahora = Date.now();
  if (cacheVigentes && cacheVigentes.expira > ahora) return cacheVigentes.versiones;

  const versiones = await prisma.tarifaUteVersion.findMany({
    where: { publicada: true },
    select: { id: true, nombre: true, vigenteDesde: true },
    orderBy: { vigenteDesde: "desc" },
  });
  cacheVigentes = { versiones, expira: ahora + CACHE_TTL_MS };
  return versiones;
}

/**
 * Versión aplicable a un periodo: la publicada con mayor `vigenteDesde` que no
 * sea posterior al último día del mes.
 *
 * Se compara contra el último día y no contra el primero para que una tarifa que
 * entra en vigencia a mitad de mes rija ese mes completo — es como se factura.
 */
export async function resolverVersionVigente(periodo: Periodo): Promise<VersionVigencia> {
  const corte = ultimoDiaDelPeriodo(periodo);
  const versiones = await versionesPublicadas();
  const encontrada = versiones.find((v) => v.vigenteDesde <= corte);

  if (!encontrada) {
    throw badRequest(
      "TARIFA_NO_VIGENTE",
      `No hay ningún cuadro tarifario publicado que cubra ${periodo}. ` +
        `Cargá y publicá las tarifas UTE antes de calcular reportes de ese mes.`,
    );
  }
  return encontrada;
}

/** Cuadro tarifario completo, en el formato que consume el motor. */
export async function getSnapshot(versionId: string): Promise<TarifaSnapshot> {
  const ahora = Date.now();
  const cached = cacheSnapshots.get(versionId);
  if (cached && cached.expira > ahora) return cached.snapshot;

  const version = await prisma.tarifaUteVersion.findUnique({
    where: { id: versionId },
    include: {
      cargos: true,
      tramos: { orderBy: { orden: "asc" } },
      franjas: true,
    },
  });
  if (!version) throw notFound("TARIFA_NO_ENCONTRADA", "El cuadro tarifario no existe");

  const cargos = {} as TarifaSnapshot["cargos"];
  for (const c of version.cargos) {
    cargos[tarifaAKey(c.tarifa)] = {
      cargoFijo: dec(c.cargoFijo),
      cargoPotenciaKw: dec(c.cargoPotenciaKw),
    };
  }

  const franjasDe = (t: TarifaUte) => {
    const out: Record<string, number> = {};
    for (const f of version.franjas.filter((x) => x.tarifa === t)) {
      out[f.franja.toLowerCase()] = dec(f.precioKwh);
    }
    return out;
  };

  const snapshot: TarifaSnapshot = {
    cargos,
    tramosSimple: version.tramos
      .filter((t) => t.tarifa === TarifaUte.SIMPLE)
      .map((t) => ({ desdeKwh: t.desdeKwh, hastaKwh: t.hastaKwh, precioKwh: dec(t.precioKwh) })),
    franjasDoble: franjasDe(TarifaUte.DOBLE) as TarifaSnapshot["franjasDoble"],
    franjasTriple: franjasDe(TarifaUte.TRIPLE) as TarifaSnapshot["franjasTriple"],
    franjasZafral: franjasDe(TarifaUte.ZAFRAL) as TarifaSnapshot["franjasZafral"],
    ivaPct: dec(version.ivaPct),
    irpfPct: dec(version.irpfPct),
  };

  cacheSnapshots.set(versionId, { snapshot, expira: ahora + CACHE_TTL_MS });
  return snapshot;
}

/**
 * Resolutor listo para pasarle al motor: cachea por periodo dentro de una misma
 * corrida, así calcular 50 clientes × 24 meses no dispara 1200 lookups.
 */
export async function crearResolutorTarifas(periodos: Periodo[]) {
  const porPeriodo = new Map<Periodo, TarifaSnapshot>();
  const versionPorPeriodo = new Map<Periodo, string>();

  for (const periodo of [...new Set(periodos)]) {
    const version = await resolverVersionVigente(periodo);
    versionPorPeriodo.set(periodo, version.id);
    porPeriodo.set(periodo, await getSnapshot(version.id));
  }

  return {
    tarifaPorPeriodo: (periodo: Periodo): TarifaSnapshot => {
      const s = porPeriodo.get(periodo);
      if (!s) throw badRequest("TARIFA_NO_RESUELTA", `No se resolvió la tarifa de ${periodo}`);
      return s;
    },
    versionIdPorPeriodo: (periodo: Periodo): string => {
      const id = versionPorPeriodo.get(periodo);
      if (!id) throw badRequest("TARIFA_NO_RESUELTA", `No se resolvió la tarifa de ${periodo}`);
      return id;
    },
  };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function listarVersiones() {
  const versiones = await prisma.tarifaUteVersion.findMany({
    orderBy: { vigenteDesde: "desc" },
    include: {
      creadaPor: { select: { id: true, name: true } },
      _count: { select: { calculos: true } },
    },
  });

  return versiones.map((v) => ({
    id: v.id,
    nombre: v.nombre,
    vigenteDesde: v.vigenteDesde.toISOString().slice(0, 10),
    vigenteHasta: v.vigenteHasta?.toISOString().slice(0, 10) ?? null,
    publicada: v.publicada,
    ivaPct: dec(v.ivaPct),
    irpfPct: dec(v.irpfPct),
    notas: v.notas,
    creadaPor: v.creadaPor.name,
    createdAt: v.createdAt.toISOString(),
    // Cuántos reportes ya calculados dependen de esta versión.
    calculosUsando: v._count.calculos,
  }));
}

export async function getVersion(id: string) {
  const v = await prisma.tarifaUteVersion.findUnique({
    where: { id },
    include: {
      cargos: true,
      tramos: { orderBy: { orden: "asc" } },
      franjas: true,
      creadaPor: { select: { id: true, name: true } },
      _count: { select: { calculos: true } },
    },
  });
  if (!v) throw notFound("TARIFA_NO_ENCONTRADA", "El cuadro tarifario no existe");

  return {
    id: v.id,
    nombre: v.nombre,
    vigenteDesde: v.vigenteDesde.toISOString().slice(0, 10),
    vigenteHasta: v.vigenteHasta?.toISOString().slice(0, 10) ?? null,
    publicada: v.publicada,
    ivaPct: dec(v.ivaPct),
    irpfPct: dec(v.irpfPct),
    notas: v.notas,
    creadaPor: v.creadaPor.name,
    calculosUsando: v._count.calculos,
    cargos: v.cargos.map((c) => ({
      tarifa: c.tarifa,
      cargoFijo: dec(c.cargoFijo),
      cargoPotenciaKw: dec(c.cargoPotenciaKw),
    })),
    tramos: v.tramos.map((t) => ({
      tarifa: t.tarifa,
      orden: t.orden,
      desdeKwh: t.desdeKwh,
      hastaKwh: t.hastaKwh,
      precioKwh: dec(t.precioKwh),
    })),
    franjas: v.franjas.map((f) => ({
      tarifa: f.tarifa,
      franja: f.franja,
      precioKwh: dec(f.precioKwh),
    })),
  };
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export interface CuadroTarifario {
  cargos: Array<{ tarifa: TarifaUte; cargoFijo: number; cargoPotenciaKw: number }>;
  tramos: Array<{ tarifa: TarifaUte; orden: number; desdeKwh: number; hastaKwh: number; precioKwh: number }>;
  franjas: Array<{ tarifa: TarifaUte; franja: FranjaHoraria; precioKwh: number }>;
}

export interface CrearVersionInput extends Partial<CuadroTarifario> {
  nombre: string;
  vigenteDesde: Date;
  ivaPct?: number;
  irpfPct?: number;
  notas?: string | null;
  /** Si viene, copia cargos/tramos/franjas de esa versión. */
  clonarDeId?: string;
  publicada?: boolean;
}

export async function crearVersion(input: CrearVersionInput, userId: string) {
  const yaExiste = await prisma.tarifaUteVersion.findUnique({
    where: { vigenteDesde: input.vigenteDesde },
  });
  if (yaExiste) {
    throw conflict(
      "TARIFA_VIGENCIA_DUPLICADA",
      `Ya existe un cuadro tarifario con vigencia desde ${input.vigenteDesde.toISOString().slice(0, 10)}`,
    );
  }

  let cuadro: CuadroTarifario = {
    cargos: input.cargos ?? [],
    tramos: input.tramos ?? [],
    franjas: input.franjas ?? [],
  };

  if (input.clonarDeId) {
    const origen = await prisma.tarifaUteVersion.findUnique({
      where: { id: input.clonarDeId },
      include: { cargos: true, tramos: true, franjas: true },
    });
    if (!origen) throw notFound("TARIFA_NO_ENCONTRADA", "El cuadro a clonar no existe");
    cuadro = {
      cargos: origen.cargos.map((c) => ({
        tarifa: c.tarifa,
        cargoFijo: dec(c.cargoFijo),
        cargoPotenciaKw: dec(c.cargoPotenciaKw),
      })),
      tramos: origen.tramos.map((t) => ({
        tarifa: t.tarifa,
        orden: t.orden,
        desdeKwh: t.desdeKwh,
        hastaKwh: t.hastaKwh,
        precioKwh: dec(t.precioKwh),
      })),
      franjas: origen.franjas.map((f) => ({
        tarifa: f.tarifa,
        franja: f.franja,
        precioKwh: dec(f.precioKwh),
      })),
    };
  }

  if (input.publicada) validarCuadroCompleto(cuadro);

  const version = await prisma.tarifaUteVersion.create({
    data: {
      nombre: input.nombre,
      vigenteDesde: input.vigenteDesde,
      ivaPct: input.ivaPct ?? 0.22,
      irpfPct: input.irpfPct ?? 0.12,
      notas: input.notas ?? null,
      publicada: input.publicada ?? false,
      creadaPorId: userId,
      cargos: { create: cuadro.cargos },
      tramos: { create: cuadro.tramos },
      franjas: { create: cuadro.franjas },
    },
  });

  if (input.publicada) await cerrarVigenciaAnterior(version.id, input.vigenteDesde);
  clearTarifasCache();

  await createAuditEntry({
    entityType: AuditEntityType.tarifa_ute_version,
    entityId: version.id,
    userId,
    action: AuditAction.created,
    description: `Creó el cuadro tarifario UTE "${input.nombre}" (vigente desde ${input.vigenteDesde.toISOString().slice(0, 10)})`,
  });

  return version.id;
}

/** Sólo se puede editar un borrador: una versión publicada es inmutable. */
export async function actualizarVersion(
  id: string,
  input: Partial<CuadroTarifario> & {
    nombre?: string;
    vigenteDesde?: Date;
    ivaPct?: number;
    irpfPct?: number;
    notas?: string | null;
  },
  userId: string,
) {
  const actual = await prisma.tarifaUteVersion.findUnique({ where: { id } });
  if (!actual) throw notFound("TARIFA_NO_ENCONTRADA", "El cuadro tarifario no existe");
  if (actual.publicada) {
    throw conflict(
      "TARIFA_PUBLICADA",
      "Un cuadro publicado no se puede editar: los reportes ya calculados dependen de él. " +
        "Duplicalo y publicá una versión nueva con la vigencia que corresponda.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.tarifaUteVersion.update({
      where: { id },
      data: {
        ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
        ...(input.vigenteDesde !== undefined ? { vigenteDesde: input.vigenteDesde } : {}),
        ...(input.ivaPct !== undefined ? { ivaPct: input.ivaPct } : {}),
        ...(input.irpfPct !== undefined ? { irpfPct: input.irpfPct } : {}),
        ...(input.notas !== undefined ? { notas: input.notas } : {}),
      },
    });

    // Reemplazo completo de cada colección que venga: es más simple y seguro que
    // un diff, y son pocas filas.
    if (input.cargos) {
      await tx.tarifaUteCargo.deleteMany({ where: { versionId: id } });
      await tx.tarifaUteCargo.createMany({ data: input.cargos.map((c) => ({ ...c, versionId: id })) });
    }
    if (input.tramos) {
      await tx.tarifaUteTramo.deleteMany({ where: { versionId: id } });
      await tx.tarifaUteTramo.createMany({ data: input.tramos.map((t) => ({ ...t, versionId: id })) });
    }
    if (input.franjas) {
      await tx.tarifaUteFranja.deleteMany({ where: { versionId: id } });
      await tx.tarifaUteFranja.createMany({ data: input.franjas.map((f) => ({ ...f, versionId: id })) });
    }
  });

  clearTarifasCache();

  await createAuditEntry({
    entityType: AuditEntityType.tarifa_ute_version,
    entityId: id,
    userId,
    action: AuditAction.updated,
    description: `Editó el cuadro tarifario UTE "${input.nombre ?? actual.nombre}"`,
  });
}

export async function publicarVersion(id: string, userId: string) {
  const v = await prisma.tarifaUteVersion.findUnique({
    where: { id },
    include: { cargos: true, tramos: true, franjas: true },
  });
  if (!v) throw notFound("TARIFA_NO_ENCONTRADA", "El cuadro tarifario no existe");
  if (v.publicada) throw conflict("TARIFA_YA_PUBLICADA", "Este cuadro ya está publicado");

  validarCuadroCompleto({
    cargos: v.cargos.map((c) => ({
      tarifa: c.tarifa,
      cargoFijo: dec(c.cargoFijo),
      cargoPotenciaKw: dec(c.cargoPotenciaKw),
    })),
    tramos: v.tramos.map((t) => ({
      tarifa: t.tarifa,
      orden: t.orden,
      desdeKwh: t.desdeKwh,
      hastaKwh: t.hastaKwh,
      precioKwh: dec(t.precioKwh),
    })),
    franjas: v.franjas.map((f) => ({ tarifa: f.tarifa, franja: f.franja, precioKwh: dec(f.precioKwh) })),
  });

  await prisma.tarifaUteVersion.update({ where: { id }, data: { publicada: true } });
  await cerrarVigenciaAnterior(id, v.vigenteDesde);
  clearTarifasCache();

  await createAuditEntry({
    entityType: AuditEntityType.tarifa_ute_version,
    entityId: id,
    userId,
    action: AuditAction.updated,
    description: `Publicó el cuadro tarifario UTE "${v.nombre}" con vigencia desde ${v.vigenteDesde.toISOString().slice(0, 10)}`,
  });
}

/**
 * Cierra la vigencia de la versión publicada inmediatamente anterior. El
 * `vigenteHasta` es informativo (la resolución usa `vigenteDesde`), pero deja
 * legible en la UI hasta cuándo rigió cada cuadro.
 */
async function cerrarVigenciaAnterior(nuevaId: string, vigenteDesde: Date) {
  const anterior = await prisma.tarifaUteVersion.findFirst({
    where: { publicada: true, id: { not: nuevaId }, vigenteDesde: { lt: vigenteDesde } },
    orderBy: { vigenteDesde: "desc" },
  });
  if (!anterior) return;

  const hasta = new Date(vigenteDesde);
  hasta.setUTCDate(hasta.getUTCDate() - 1);
  await prisma.tarifaUteVersion.update({ where: { id: anterior.id }, data: { vigenteHasta: hasta } });
}

const TODAS: TarifaUte[] = [TarifaUte.SIMPLE, TarifaUte.DOBLE, TarifaUte.TRIPLE, TarifaUte.ZAFRAL];

/**
 * Un cuadro incompleto rompe el cálculo a mitad de camino, con un error que no
 * dice nada útil. Se valida al publicar para que el problema aparezca acá.
 */
export function validarCuadroCompleto(cuadro: CuadroTarifario) {
  const faltan: string[] = [];

  for (const t of TODAS) {
    if (!cuadro.cargos.some((c) => c.tarifa === t)) faltan.push(`cargos de la tarifa ${t}`);
  }

  const tramosSimple = cuadro.tramos
    .filter((t) => t.tarifa === TarifaUte.SIMPLE)
    .sort((a, b) => a.orden - b.orden);
  if (tramosSimple.length === 0) faltan.push("tramos de consumo de la tarifa simple");

  // Los tramos tienen que cubrir el rango sin huecos ni solapes: un hueco haría
  // que parte del consumo no se facture y nadie se entere.
  for (let i = 0; i < tramosSimple.length; i++) {
    const t = tramosSimple[i];
    if (t.hastaKwh < t.desdeKwh) faltan.push(`el tramo ${i + 1} de la simple termina antes de empezar`);
    if (i === 0 && t.desdeKwh !== 0) faltan.push("el primer tramo de la simple tiene que arrancar en 0");
    if (i > 0 && t.desdeKwh !== tramosSimple[i - 1].hastaKwh + 1) {
      faltan.push(`hay un salto entre el tramo ${i} y el ${i + 1} de la simple`);
    }
  }

  const requeridas: Array<[TarifaUte, FranjaHoraria[]]> = [
    [TarifaUte.DOBLE, [FranjaHoraria.PUNTA, FranjaHoraria.FUERA_PUNTA]],
    [TarifaUte.TRIPLE, [FranjaHoraria.PUNTA, FranjaHoraria.LLANO, FranjaHoraria.VALLE]],
    [TarifaUte.ZAFRAL, [FranjaHoraria.PUNTA, FranjaHoraria.LLANO, FranjaHoraria.VALLE]],
  ];
  for (const [tarifa, franjas] of requeridas) {
    for (const franja of franjas) {
      if (!cuadro.franjas.some((f) => f.tarifa === tarifa && f.franja === franja)) {
        faltan.push(`el precio de ${franja} en la tarifa ${tarifa}`);
      }
    }
  }

  if (faltan.length > 0) {
    throw badRequest(
      "TARIFA_INCOMPLETA",
      `El cuadro tarifario está incompleto. Falta: ${faltan.join("; ")}.`,
    );
  }
}
