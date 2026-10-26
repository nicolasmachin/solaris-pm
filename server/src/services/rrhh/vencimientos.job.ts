// Job diario de vencimientos del legajo (carné de salud, licencia de conducir,
// cursos, constancias de BPS/BSE…).
//
// Avisa a la persona y a quien gestiona RRHH dos veces por documento: cuando
// entra en los 30 días previos y cuando vence. De cada tipo cuenta el documento
// más nuevo (un carné viejo ya reemplazado no avisa) y no se avisa por gente
// con fecha de egreso.
//
// Idempotente: cada aviso tiene uniqueKey (documento + hito + destinatario).

import cron from "node-cron";
import { Action, LegajoDocumentoEstado, Module, NotificationType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { hoyUruguay } from "../../utils/uruguay.js";
import { createNotificationByUniqueKey } from "../notification.service.js";
import { DIAS_AVISO_VENCIMIENTO, TIPO_LABEL, diasHasta } from "./rrhh.service.js";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10).split("-").reverse().join("/");
}

export async function avisarVencimientosLegajo(now: Date = new Date()) {
  const hoyIso = hoyUruguay(now).iso;
  const limite = new Date(`${hoyIso}T00:00:00.000Z`);
  limite.setUTCDate(limite.getUTCDate() + DIAS_AVISO_VENCIMIENTO);

  const docs = await prisma.legajoDocumento.findMany({
    where: {
      deletedAt: null,
      estado: { not: LegajoDocumentoEstado.RECHAZADO },
      vencimiento: { not: null },
      legajo: { fechaEgreso: null, user: { deletedAt: null } },
    },
    select: {
      id: true,
      tipo: true,
      vencimiento: true,
      createdAt: true,
      legajoId: true,
      legajo: { select: { userId: true, user: { select: { name: true } } } },
    },
  });

  // El más nuevo de cada tipo por legajo.
  const vigentes = new Map<string, (typeof docs)[number]>();
  for (const d of docs) {
    const clave = `${d.legajoId}:${d.tipo}`;
    const prev = vigentes.get(clave);
    if (!prev || d.createdAt > prev.createdAt) vigentes.set(clave, d);
  }

  const permisos = await prisma.permission.findMany({
    where: { module: Module.RRHH, action: Action.EDIT },
    select: { roleId: true },
  });
  const gestores = await prisma.user.findMany({
    where: { deletedAt: null, roleId: { in: permisos.map((p) => p.roleId) } },
    select: { id: true },
  });

  let creadas = 0;
  for (const d of vigentes.values()) {
    if (!d.vencimiento || d.vencimiento > limite) continue;
    const vencido = diasHasta(d.vencimiento, hoyIso) < 0;
    const hito = vencido ? "vencido" : "por-vencer";
    const tipo = TIPO_LABEL[d.tipo];
    const nombre = d.legajo.user.name;
    const destinatarios = new Set([d.legajo.userId, ...gestores.map((g) => g.id)]);
    for (const userId of destinatarios) {
      const propio = userId === d.legajo.userId;
      const { created } = await createNotificationByUniqueKey({
        uniqueKey: `legajo-${hito}:${d.id}:${userId}`,
        userId,
        type: NotificationType.legajo_vencimiento,
        title: vencido
          ? `${propio ? "Tu" : nombre + ":"} ${tipo.toLowerCase()} venció`
          : `${propio ? "Tu" : nombre + ":"} ${tipo.toLowerCase()} vence el ${fmt(d.vencimiento)}`,
        message: propio
          ? "Renovalo y subí el nuevo en Mi legajo."
          : "Hay que pedirle el nuevo y subirlo a su legajo.",
        link: propio ? "/mi-legajo" : `/rrhh/legajos/${d.legajo.userId}`,
      });
      if (created) creadas++;
    }
  }
  return { avisos: creadas };
}

// Todos los días a las 07:00 (configurable).
export function startVencimientosLegajoJob() {
  const expr = process.env.CRON_VENCIMIENTOS_LEGAJO || "0 7 * * *";
  return cron.schedule(expr, async () => {
    try {
      const r = await avisarVencimientosLegajo();
      if (r.avisos) console.log(`[legajo] avisos de vencimiento nuevos: ${r.avisos}`);
    } catch (err) {
      console.error("[legajo] job error:", err);
    }
  });
}
