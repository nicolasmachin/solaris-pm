// Plantas que no tienen que dar aviso aunque no generen: en obra (la propia o
// una ampliación, agendada en el calendario) o silenciadas a mano desde el
// monitoreo. Caso real: Barenof, desconectada por la obra de ampliación del
// 26 al 30-oct-2026.

import { prisma } from "../../lib/prisma.js";

/** Días después del fin de la obra que se sigue sin avisar (la reconexión se demora). */
const MARGEN_DIAS = 1;

export type Pausa = { motivo: "OBRA" | "SILENCIADA"; hasta: string };

const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function pausasDePlantas(
  projectIds: string[],
  hoy: string,
  silenciadas: Map<string, Date | null>,
): Promise<Map<string, Pausa>> {
  const out = new Map<string, Pausa>();
  for (const [projectId, hasta] of silenciadas) {
    if (hasta && dia(hasta) >= hoy) out.set(projectId, { motivo: "SILENCIADA", hasta: dia(hasta) });
  }
  if (projectIds.length === 0) return out;

  const hoyD = new Date(`${hoy}T00:00:00Z`);
  const desdeFin = new Date(hoyD.getTime() - MARGEN_DIAS * 86_400_000);
  // Obra del proyecto o de una ampliación suya (Project.parentProjectId).
  const segmentos = await prisma.installationSegment.findMany({
    where: {
      startDate: { lte: hoyD },
      endDate: { gte: desdeFin },
      schedule: {
        deletedAt: null,
        project: {
          deletedAt: null,
          OR: [{ id: { in: projectIds } }, { parentProjectId: { in: projectIds } }],
        },
      },
    },
    select: { endDate: true, schedule: { select: { project: { select: { id: true, parentProjectId: true } } } } },
  });
  for (const s of segmentos) {
    const p = s.schedule.project;
    const titular = p.parentProjectId && projectIds.includes(p.parentProjectId) ? p.parentProjectId : p.id;
    const hasta = dia(new Date(s.endDate.getTime() + MARGEN_DIAS * 86_400_000));
    const previa = out.get(titular);
    if (!previa || previa.motivo === "SILENCIADA" || hasta > previa.hasta) out.set(titular, { motivo: "OBRA", hasta });
  }
  return out;
}
