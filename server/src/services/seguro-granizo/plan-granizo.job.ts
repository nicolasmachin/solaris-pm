// Job diario del Plan de Protección contra Granizo.
//
//   1. Pone en marcha los planes contratados con la obra cuando se registra la
//      puesta en marcha (habilitación): genera la anualidad 1 con su cobro.
//   2. Genera la anualidad siguiente 30 días antes del vencimiento, al precio
//      vigente (condiciones, sección 5: renovación automática).
//   3. Avisa a Experiencia Solar (campana + correo de la mañana): plan por
//      vencer, vencido sin pago (en gracia), suspendido, y daños por granizo con
//      el plazo de inspección o de reposición vencido.
//
// NO le escribe al cliente: el aviso de vencimiento que prometen las condiciones
// lo manda una persona con el mensaje modelo del plan (Manual de Posventa,
// Anexo D: el sistema no le escribe al cliente por su cuenta).
//
// Idempotente: activar/renovar se chequean por estado y por @@unique(poliza,
// numero); los avisos, por uniqueKey (uno por hito y por usuario, de por vida).

import cron from "node-cron";
import { NotificationType, SeguroGranizoEstado } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { getAnclaMantenimiento } from "../../utils/aniversario.js";
import { createNotificationByUniqueKey } from "../notification.service.js";
import { usuariosPorRol } from "../usuarios-por-rol.js";
import { DIAS_AVISO, DIAS_GRACIA } from "./estado.js";
import { addDays, diffInDays, fmtFecha, startOfUtcDay } from "./fechas.js";
import { calcularPlazosDanio } from "./plazos.js";
import {
  activarPoliza,
  estadoDePoliza,
  listarPolizasCompletas,
  precioPlanPorPanelUsd,
  renovarPoliza,
  resolverCantidadPaneles,
} from "./polizas.service.js";

function usd(n: number) {
  return `USD ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;
}

type Aviso = { projectId: string; type: NotificationType; title: string; message: string; key: string };

// Lo que hay que avisarle al equipo hoy, sin efectos. Separado para poder
// probarlo y para que el resumen de la mañana use lo mismo.
export async function avisosPlanGranizo(now: Date = new Date()): Promise<Aviso[]> {
  const hoy = startOfUtcDay(now);
  const planes = await listarPolizasCompletas();
  const avisos: Aviso[] = [];
  for (const p of planes) {
    const e = estadoDePoliza(p, hoy);
    const cliente = p.project.clientName;
    const vencio = e.proximoCobro?.fecha ?? null;
    if (e.estado === "POR_VENCER" && e.vencimiento) {
      avisos.push({
        projectId: p.projectId,
        type: NotificationType.seguro_granizo_por_vencer,
        title: `Plan de granizo por vencer · ${cliente}`,
        message:
          `Vence el ${fmtFecha(e.vencimiento)}. Avisale al cliente y cobrá la anualidad siguiente` +
          (e.proximoCobro ? ` (${usd(e.proximoCobro.montoUsd)})` : "") +
          `. Hay un mensaje modelo en el plan.`,
        key: `plan-granizo:vence:${e.periodoActualId ?? p.id}`,
      });
    }
    if (e.estado === "EN_GRACIA" && vencio) {
      avisos.push({
        projectId: p.projectId,
        type: NotificationType.seguro_granizo_impago,
        title: `Plan de granizo vencido sin pago · ${cliente}`,
        message: `Venció el ${fmtFecha(vencio)} y sigue cubierto hasta el ${fmtFecha(addDays(vencio, DIAS_GRACIA))}. Después queda suspendido.`,
        key: `plan-granizo:gracia:${e.proximoCobro?.periodoId ?? p.id}`,
      });
    }
    if (e.estado === "SUSPENDIDA") {
      avisos.push({
        projectId: p.projectId,
        type: NotificationType.seguro_granizo_impago,
        title: `Plan de granizo suspendido · ${cliente}`,
        message: `Pasaron más de ${DIAS_GRACIA} días sin pago: no cubre. Si paga, corre una nueva carencia de 30 días.`,
        key: `plan-granizo:suspendido:${e.proximoCobro?.periodoId ?? p.id}`,
      });
    }
    for (const s of p.siniestros) {
      const plazos = calcularPlazosDanio(s, hoy);
      if (!plazos.pendiente?.vencido) continue;
      const etapa = plazos.pendiente.etapa;
      const limite = etapa === "INSPECCION" ? plazos.inspeccion.limite : plazos.reposicion?.limite;
      avisos.push({
        projectId: p.projectId,
        type: NotificationType.seguro_granizo_danio_plazo,
        title: `Daño por granizo con plazo vencido · ${cliente}`,
        message: `La ${etapa === "INSPECCION" ? "inspección" : "reposición"} del granizo del ${fmtFecha(s.fechaEvento)} vencía el ${limite ? fmtFecha(limite) : "—"}.`,
        key: `plan-granizo:danio:${s.id}:${etapa}`,
      });
    }
  }
  return avisos;
}

// Alertas "con plazo y ya vencido" para el correo de la mañana de Experiencia
// Solar (construirResumenExperiencia). El "por vencer" no va acá: todavía no
// venció; llega por la campana y el resumen de notificaciones.
export async function alertasPlanGranizoResumen(now: Date = new Date()) {
  const hoy = startOfUtcDay(now);
  const planes = await listarPolizasCompletas();
  const out: Array<{ projectId: string; cliente: string; titulo: string; detalle: string; dias: number | null }> = [];
  for (const p of planes) {
    const e = estadoDePoliza(p, hoy);
    const cliente = p.project.clientName;
    const vencio = e.proximoCobro?.fecha ?? null;
    if ((e.estado === "EN_GRACIA" || e.estado === "SUSPENDIDA") && vencio) {
      const dias = diffInDays(vencio, hoy);
      out.push({
        projectId: p.projectId,
        cliente,
        titulo: e.estado === "EN_GRACIA" ? "Plan de granizo vencido sin pago (en gracia)" : "Plan de granizo suspendido por falta de pago",
        detalle: `Venció el ${fmtFecha(vencio)} · ${usd(e.proximoCobro!.montoUsd)}`,
        dias,
      });
    }
    for (const s of p.siniestros) {
      const plazos = calcularPlazosDanio(s, hoy);
      if (!plazos.pendiente?.vencido) continue;
      const limite = plazos.pendiente.etapa === "INSPECCION" ? plazos.inspeccion.limite : plazos.reposicion!.limite;
      out.push({
        projectId: p.projectId,
        cliente,
        titulo: `Daño por granizo: ${plazos.pendiente.etapa === "INSPECCION" ? "falta la inspección" : "falta reponer"}`,
        detalle: `Granizo del ${fmtFecha(s.fechaEvento)} · vencía el ${fmtFecha(limite)}`,
        dias: diffInDays(limite, hoy),
      });
    }
  }
  return out;
}

export async function chequearPlanesGranizo(now: Date = new Date()) {
  const hoy = startOfUtcDay(now);
  let activados = 0;
  let renovados = 0;
  let notificaciones = 0;

  // 1. Planes contratados con la obra que ya tienen puesta en marcha.
  const pendientes = await prisma.seguroGranizoPoliza.findMany({
    where: { deletedAt: null, estado: SeguroGranizoEstado.PENDIENTE_INICIO },
    select: {
      id: true,
      projectId: true,
      cantidadPanelesFuente: true,
      precioPorPanelUsd: true,
      periodos: { select: { id: true } },
      project: { select: { postHabilitacionInicioEn: true, actualUteEnd: true } },
    },
  });
  for (const p of pendientes) {
    const ancla = getAnclaMantenimiento(p.project);
    if (!ancla || p.periodos.length > 0 || startOfUtcDay(ancla).getTime() > hoy.getTime()) continue;
    try {
      // Si la cantidad no se cargó a mano, se recuenta: el unifilar pudo
      // aparecer entre la venta y la puesta en marcha.
      if (p.cantidadPanelesFuente !== "MANUAL") {
        const r = await resolverCantidadPaneles(p.projectId);
        if (r.cantidad) {
          const precio = Number(p.precioPorPanelUsd) || (await precioPlanPorPanelUsd());
          await prisma.seguroGranizoPoliza.update({
            where: { id: p.id },
            data: { cantidadPaneles: r.cantidad, cantidadPanelesFuente: r.fuente, montoAnualUsd: Math.round(precio * r.cantidad * 100) / 100 },
          });
        }
      }
      await activarPoliza(p.id, ancla, null);
      activados++;
    } catch (err) {
      console.error(`[plan-granizo] no se pudo poner en marcha ${p.id}:`, err);
    }
  }

  // 2. Renovación 30 días antes del vencimiento.
  for (const p of await listarPolizasCompletas()) {
    if (p.estado !== SeguroGranizoEstado.ACTIVA) continue;
    const ultimo = p.periodos[p.periodos.length - 1];
    if (!ultimo || diffInDays(hoy, ultimo.hasta) > DIAS_AVISO) continue;
    try {
      await renovarPoliza(p.id, null);
      renovados++;
    } catch (err) {
      console.error(`[plan-granizo] no se pudo renovar ${p.id}:`, err);
    }
  }

  // 3. Avisos al equipo, uno por hito y por persona.
  const avisos = await avisosPlanGranizo(hoy);
  if (avisos.length) {
    const equipo = await usuariosPorRol("EXPERIENCIA_SOLAR");
    for (const a of avisos) {
      for (const u of equipo) {
        const { created } = await createNotificationByUniqueKey({
          userId: u.id,
          projectId: a.projectId,
          type: a.type,
          title: a.title,
          message: a.message,
          link: `/clientes/${a.projectId}`,
          uniqueKey: `${a.key}:${u.id}`,
        });
        if (created) notificaciones++;
      }
    }
  }

  return { activados, renovados, avisos: avisos.length, notificaciones };
}

// Todos los días a las 06:30 (configurable). Antes del correo de la mañana, para
// que lo que genera ya entre en el resumen.
export function startPlanGranizoJob() {
  const expr = process.env.CRON_PLAN_GRANIZO || "30 6 * * *";
  return cron.schedule(expr, async () => {
    try {
      const r = await chequearPlanesGranizo();
      if (r.activados || r.renovados || r.notificaciones) {
        console.log(`[plan-granizo] en marcha ${r.activados}, renovados ${r.renovados}, avisos nuevos ${r.notificaciones}`);
      }
    } catch (err) {
      console.error("[plan-granizo] job error:", err);
    }
  });
}
