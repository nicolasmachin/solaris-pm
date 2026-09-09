/**
 * Datos de prueba del recorrido de Experiencia Solar — SOLO DESARROLLO.
 *
 * Problema que resuelve: la base de desarrollo tiene la cartera real importada,
 * y ahí **casi nadie tiene etapa** (45 de 93) ni pasos tildados ni bitácora. Con
 * esos datos no se puede probar nada: el pipeline sale vacío, el semáforo no
 * distingue nada y los avisos clave o no aparecen o aparecen todos.
 *
 * Esto reparte una muestra de clientes en las tres etapas y les arma escenarios
 * distintos, para poder ver de una pasada:
 *
 *   - Un cliente **al día**: pasos completos y contacto reciente.
 *   - Uno **fuera de cadencia**: sin contacto hace mucho.
 *   - Uno con un **aviso clave vencido**: el reloj corriendo y en rojo.
 *   - Uno **sin contacto nunca**: el peor caso del orden.
 *
 * Idempotente: se puede correr las veces que haga falta.
 *
 *   docker compose exec server npx tsx prisma/scripts/dev-seed-recorrido.ts
 *
 * NO corre con NODE_ENV=production ni contra una base que no sea la local.
 */

import { InteractionChannel, InteractionDirection, InteractionReason, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Guard: este script inventa datos. En producción sería corromper la cartera.
function abortarSiEsProduccion(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev-seed-recorrido NO puede correr con NODE_ENV=production");
  }
  const url = process.env.DATABASE_URL ?? "";
  const esLocal = /@(postgres|localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!esLocal) {
    throw new Error(`dev-seed-recorrido solo corre contra la base local. DATABASE_URL apunta a otro lado.`);
  }
}

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);
const dentroDe = (dias: number) => new Date(Date.now() + dias * DIA);

/**
 * Los escenarios. El orden importa: se aplican a los primeros N proyectos de cada
 * etapa, así siempre se puede entrar a la pantalla y encontrar los cuatro casos.
 */
type Escenario = {
  nombre: string;
  /** Días desde el último contacto. null = nunca se lo contactó. */
  diasSinContacto: number | null;
  /** Códigos de check a marcar como completados. */
  completar: string[];
  /** Códigos de check a dejar pendientes CON el reloj corriendo (vencidos si es negativo). */
  conPlazo: Array<{ codigo: string; venceEnDias: number }>;
};

const ESCENARIOS_E1: Escenario[] = [
  {
    nombre: "al día",
    diasSinContacto: 1,
    completar: ["e1_bienvenida", "e1_expectativa", "e1_portal", "e1_capataz"],
    conPlazo: [{ codigo: "e1_fecha_obra", venceEnDias: 2 }],
  },
  {
    nombre: "fuera de cadencia",
    diasSinContacto: 12,
    completar: ["e1_bienvenida", "e1_expectativa"],
    conPlazo: [],
  },
  {
    nombre: "aviso clave vencido",
    diasSinContacto: 4,
    completar: ["e1_bienvenida"],
    conPlazo: [{ codigo: "e1_fecha_obra", venceEnDias: -3 }],
  },
  { nombre: "nunca contactado", diasSinContacto: null, completar: [], conPlazo: [] },
];

const ESCENARIOS_E2: Escenario[] = [
  {
    nombre: "al día",
    diasSinContacto: 2,
    completar: ["e1_bienvenida", "e1_obra_terminada", "e1_encuesta_obra"],
    conPlazo: [],
  },
  {
    nombre: "habilitación vencida",
    diasSinContacto: 9,
    completar: ["e1_bienvenida", "e1_obra_terminada"],
    conPlazo: [{ codigo: "e2_habilitacion", venceEnDias: -2 }],
  },
  { nombre: "nunca contactado", diasSinContacto: null, completar: [], conPlazo: [] },
];

const ESCENARIOS_E3: Escenario[] = [
  {
    nombre: "cierre completo",
    diasSinContacto: 5,
    completar: [
      "e1_bienvenida",
      "e2_habilitacion",
      "e3_capacitacion",
      "e3_acceso_inversor",
      "e3_alta_reportes",
      "e3_garantias",
      "e3_portal_recorrido",
    ],
    conPlazo: [],
  },
  {
    nombre: "cierre a medias",
    diasSinContacto: 20,
    completar: ["e1_bienvenida", "e2_habilitacion", "e3_capacitacion"],
    conPlazo: [{ codigo: "e3_garantias", venceEnDias: -5 }],
  },
  { nombre: "nunca contactado", diasSinContacto: null, completar: [], conPlazo: [] },
];

async function main(): Promise<void> {
  abortarSiEsProduccion();

  const admin = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" }, deletedAt: null },
    select: { id: true },
  });
  if (!admin) throw new Error("No hay ningún usuario ADMIN para firmar los datos de prueba");

  // Se toman los proyectos SIN etapa forzada, para no pisar los que ya tienen una
  // puesta a mano. `recorridoManual` es el override manual de la ficha.
  const candidatos = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { id: true, clientName: true, recorridoManual: true },
    orderBy: { createdAt: "desc" },
  });

  const plan: Array<{ etapa: "E1" | "E2" | "E3"; escenarios: Escenario[] }> = [
    { etapa: "E1", escenarios: ESCENARIOS_E1 },
    { etapa: "E2", escenarios: ESCENARIOS_E2 },
    { etapa: "E3", escenarios: ESCENARIOS_E3 },
  ];

  let cursor = 0;
  for (const { etapa, escenarios } of plan) {
    for (const esc of escenarios) {
      const proyecto = candidatos[cursor++];
      if (!proyecto) {
        console.warn("[dev-seed] no hay más proyectos para armar escenarios");
        return;
      }
      await aplicar(proyecto.id, proyecto.clientName, etapa, esc, admin.id);
    }
  }

  await asignarAsesorFaltante();

  console.log(`\n[dev-seed] listo: ${cursor} clientes con escenarios en E1/E2/E3.`);
  console.log("[dev-seed] entrá a Experiencia Solar → Recorrido para verlos.");
}

/**
 * En desarrollo hay muchos clientes sin asesor (vienen de la importación por
 * planilla), y con la columna vacía no se puede probar ni el filtro por asesor ni
 * cómo se ve la ficha completa. Se les pone a Nicolás.
 */
async function asignarAsesorFaltante(): Promise<void> {
  const nico = await prisma.user.findFirst({
    where: { name: { contains: "Nicolas Machin", mode: "insensitive" }, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!nico) {
    console.warn("[dev-seed] no encontré el usuario 'Nicolas Machin': no se asignó asesor");
    return;
  }
  const r = await prisma.project.updateMany({
    where: { deletedAt: null, salespersonId: null },
    data: { salespersonId: nico.id },
  });
  console.log(`[dev-seed] asesor asignado a ${r.count} proyectos sin asesor → ${nico.name}`);
}

async function aplicar(
  projectId: string,
  nombre: string,
  etapa: "E1" | "E2" | "E3",
  esc: Escenario,
  actorId: string,
): Promise<void> {
  await prisma.project.update({ where: { id: projectId }, data: { recorridoManual: etapa } });

  // Los checks se crean por demanda; acá se fuerzan para poder tildarlos.
  const { ensureChecks } = await import("../../src/services/clientes/recorrido.service.js");
  await ensureChecks(projectId);

  // Estado limpio antes de aplicar el escenario, para que correrlo dos veces dé
  // el mismo resultado.
  await prisma.recorridoCheck.updateMany({
    where: { projectId },
    data: { completadoEn: null, completadoPorId: null, venceEn: null },
  });
  await prisma.recorridoCheck.updateMany({
    where: { projectId, codigo: { in: esc.completar } },
    data: { completadoEn: hace(3), completadoPorId: actorId },
  });
  for (const p of esc.conPlazo) {
    await prisma.recorridoCheck.updateMany({
      where: { projectId, codigo: p.codigo, completadoEn: null },
      data: { venceEn: p.venceEnDias >= 0 ? dentroDe(p.venceEnDias) : hace(-p.venceEnDias) },
    });
  }

  // Bitácora: se borra la de prueba anterior y se deja una sola interacción con
  // la antigüedad que pide el escenario.
  await prisma.clientInteraction.deleteMany({
    where: { projectId, content: { startsWith: "[prueba]" } },
  });
  if (esc.diasSinContacto !== null) {
    await prisma.clientInteraction.create({
      data: {
        projectId,
        authorId: actorId,
        channel: InteractionChannel.WHATSAPP,
        direction: InteractionDirection.SALIENTE,
        reason: InteractionReason.SEGUIMIENTO,
        content: `[prueba] Contacto de ejemplo para el escenario "${esc.nombre}".`,
        createdAt: hace(esc.diasSinContacto),
      },
    });
  }

  const clave = esc.conPlazo.filter((p) => p.venceEnDias < 0).length;
  console.log(
    `[dev-seed] ${etapa} · ${esc.nombre.padEnd(22)} → ${nombre}` +
      ` (${esc.completar.length} pasos hechos${clave ? `, ${clave} aviso vencido` : ""})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
