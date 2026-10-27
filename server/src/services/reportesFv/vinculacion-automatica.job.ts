// Cron quincenal: sincroniza el catálogo de Growatt y Huawei, vincula sola cada
// planta cuyo nombre coincide con un proyecto y avisa por mail de las que no.
// El criterio de "coincide" está en vinculacion-automatica.ts.

import cron from "node-cron";

import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../email.service.js";
import { sincronizarPlantas, vincularPlanta } from "./growatt/plantas.service.js";
import { sincronizarPlantasHuawei, vincularPlantaHuawei } from "./huawei/plantas.service.js";
import { MOTIVO_LABEL, emparejarPlantas, type PlantaSinVincular, type ResultadoMatching } from "./vinculacion-automatica.js";

/** Días 1 y 16 a las 09:00 de Uruguay (una hora después del monitoreo diario). */
const CRON_DEFAULT = "0 9 1,16 * *";

/** Actor de la vinculación: el primer ADMIN activo (no hay usuario de sistema). */
async function usuarioSistema(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: { name: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

function destinatarios(): string[] {
  const raw = process.env.PLANTAS_VINCULACION_EMAIL || "nicolas@voltia.com.uy";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MARCA: Record<PlantaSinVincular["marca"], string> = { GROWATT: "Growatt", HUAWEI: "Huawei" };

export interface ResultadoVinculacion extends ResultadoMatching {
  erroresSync: string[];
}

export async function vincularPlantasPorNombre(): Promise<ResultadoVinculacion> {
  const erroresSync: string[] = [];
  // Si una API falla se sigue con el catálogo que ya hay: lo conocido igual se
  // puede vincular, y el mail dice que la sincronización no anduvo.
  await sincronizarPlantas().catch((err) => {
    console.error("[vinculacion-plantas] sync Growatt:", err);
    erroresSync.push("Growatt");
  });
  await sincronizarPlantasHuawei().catch((err) => {
    console.error("[vinculacion-plantas] sync Huawei:", err);
    erroresSync.push("Huawei");
  });

  const [growatt, huawei, proyectos] = await Promise.all([
    prisma.growattPlant.findMany({ where: { projectId: null, ignorada: false }, select: { plantId: true, name: true } }),
    prisma.huaweiPlant.findMany({ where: { projectId: null, ignorada: false }, select: { plantCode: true, name: true } }),
    prisma.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        clientName: true,
        growattPlant: { select: { id: true } },
        huaweiPlant: { select: { id: true } },
      },
    }),
  ]);

  const plantas: PlantaSinVincular[] = [
    ...growatt.map((p) => ({ marca: "GROWATT" as const, id: p.plantId.toString(), nombre: p.name })),
    ...huawei.map((p) => ({ marca: "HUAWEI" as const, id: p.plantCode, nombre: p.name })),
  ];
  const r = emparejarPlantas(
    plantas,
    proyectos.map((p) => ({
      id: p.id,
      clientName: p.clientName,
      tieneGrowatt: p.growattPlant !== null,
      tieneHuawei: p.huaweiPlant !== null,
    })),
  );

  const userId = await usuarioSistema();
  const vinculadas: ResultadoMatching["vincular"] = [];
  if (userId) {
    for (const v of r.vincular) {
      try {
        if (v.planta.marca === "GROWATT") await vincularPlanta(v.planta.id, { projectId: v.proyecto.id }, userId);
        else await vincularPlantaHuawei(v.planta.id, v.proyecto.id, userId);
        vinculadas.push(v);
      } catch (err) {
        console.error(`[vinculacion-plantas] no se pudo vincular ${v.planta.nombre}:`, err);
        r.sinVincular.push({ planta: v.planta, motivo: "SIN_PROYECTO", proyectos: [] });
      }
    }
  }

  return { vincular: vinculadas, sinVincular: r.sinVincular, erroresSync };
}

export function htmlVinculacion(r: ResultadoVinculacion): string {
  const fila = (titulo: string, detalle: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eceef0;">` +
    `<div style="font-size:14px;font-weight:600;color:#12151c;">${titulo}</div>` +
    `<div style="font-size:13px;color:#4a5058;margin-top:2px;">${detalle}</div></td></tr>`;

  let html = `<div style="font-family:Arial,sans-serif;max-width:640px;">`;
  if (r.erroresSync.length > 0) {
    html += `<p style="color:#b42318;font-size:14px;">No se pudo actualizar la lista de plantas de ${r.erroresSync.join(" y ")}; se revisó con la que ya había.</p>`;
  }
  if (r.sinVincular.length > 0) {
    html +=
      `<h2 style="font-size:16px;color:#b42318;">Plantas sin proyecto en Voltia PM (${r.sinVincular.length})</h2>` +
      `<p style="font-size:13px;color:#4a5058;">No entran al monitoreo ni a los reportes hasta que se vinculen en Experiencia Solar → Reportes FV, o se marquen como ignoradas si no son nuestras.</p>` +
      `<table style="width:100%;border-collapse:collapse;">` +
      r.sinVincular
        .map((s) =>
          fila(
            `${escapar(s.planta.nombre)} <span style="font-weight:400;color:#8a9099;">— ${MARCA[s.planta.marca]}</span>`,
            escapar(MOTIVO_LABEL[s.motivo]) +
              (s.proyectos.length > 0 ? `: ${escapar(s.proyectos.map((p) => p.clientName).join(", "))}` : ""),
          ),
        )
        .join("") +
      `</table>`;
  }
  if (r.vincular.length > 0) {
    html +=
      `<h2 style="font-size:16px;color:#12151c;">Vinculadas solas (${r.vincular.length})</h2>` +
      `<table style="width:100%;border-collapse:collapse;">` +
      r.vincular
        .map((v) => fila(escapar(v.proyecto.clientName), `Planta ${MARCA[v.planta.marca]} «${escapar(v.planta.nombre)}»`))
        .join("") +
      `</table>`;
  }
  return html + `</div>`;
}

export async function ejecutarVinculacionPlantas(): Promise<ResultadoVinculacion> {
  const r = await vincularPlantasPorNombre();
  console.log(
    `[vinculacion-plantas] ${r.vincular.length} vinculadas, ${r.sinVincular.length} sin proyecto` +
      (r.erroresSync.length ? `, sync con error: ${r.erroresSync.join(", ")}` : ""),
  );
  // Sin nada que contar no sale mail.
  if (r.vincular.length === 0 && r.sinVincular.length === 0 && r.erroresSync.length === 0) return r;

  const partes: string[] = [];
  if (r.sinVincular.length) partes.push(`${r.sinVincular.length} sin proyecto`);
  if (r.vincular.length) partes.push(`${r.vincular.length} vinculadas solas`);
  if (r.erroresSync.length) partes.push(`no se pudo consultar ${r.erroresSync.join(" y ")}`);
  await sendEmail({
    to: destinatarios(),
    type: "internal",
    subject: `Plantas FV · ${partes.join(", ")}`,
    html: htmlVinculacion(r),
  });
  return r;
}

export function startVinculacionPlantasJob() {
  if (process.env.PLANTAS_VINCULACION_AUTO === "false") {
    console.log("[vinculacion-plantas] deshabilitado por PLANTAS_VINCULACION_AUTO=false");
    return null;
  }
  return cron.schedule(
    process.env.CRON_PLANTAS_VINCULACION || CRON_DEFAULT,
    async () => {
      try {
        await ejecutarVinculacionPlantas();
      } catch (err) {
        console.error("[vinculacion-plantas] error:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
}
