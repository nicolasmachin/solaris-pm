import { prisma } from "../lib/prisma.js";

// Marca actualStartDate=hoy en una subetapa cuando ocurre la primera actividad
// (comentario, cambio de estado, upload de archivo, etc.). Es idempotente: si ya
// hay actualStartDate seteado, no toca nada.
export async function markSubstageActivity(substageId: string | null | undefined): Promise<void> {
  if (!substageId) return;
  try {
    const substage = await prisma.substage.findUnique({
      where: { id: substageId },
      select: { id: true, actualStartDate: true, deletedAt: true },
    });
    if (!substage || substage.deletedAt) return;
    if (substage.actualStartDate) return;

    const today = new Date();
    const dateOnly = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    await prisma.substage.update({
      where: { id: substageId },
      data: { actualStartDate: dateOnly },
    });
  } catch (err) {
    // Best-effort: no debe romper el flujo principal si falla
    // (por ej. si la subetapa fue borrada en el ínterin).
    console.error("[markSubstageActivity] failed:", err);
  }
}
