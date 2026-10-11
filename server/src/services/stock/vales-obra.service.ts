// Vales de obra: lo que sale del local para una obra y lo que vuelve sobrante.
//
// Pedido por Nicolás el 10-oct-2026 como "lo que se viene": queda desarrollado
// pero NO se exige (ninguna subetapa depende de esto). La idea es poder saber el
// consumo real de cada obra sin pedirle al capataz que cuente cable en el techo:
//
//   consumo = lo que salió (vales de salida) − lo que volvió (vales de devolución)
//
// y compararlo con la lista de materiales definitiva (`ProjectMaterial`).
//
// No hay modelo nuevo: cada renglón de un vale es un `StockMovement` con el
// `projectId` de la obra. La salida es un EGRESO; la devolución, un INGRESO con
// `causaIngreso = OTRO` y la referencia `VALE_DEVOLUCION`, que es lo que la
// distingue de un ingreso por factura imputado a la obra. Todos los renglones
// de un vale comparten la referencia (`VALE_SALIDA`/`VALE_DEVOLUCION` + fecha y
// hora), así se pueden agrupar.
//
// Dos diferencias deliberadas con `POST /stock/movements`, para que sea liviano:
//  - Acepta materiales que no gestionan stock (hoy casi ninguno lo hace): se
//    registra el movimiento para el consumo de la obra, pero `stockActual` solo
//    se toca si el material gestiona stock.
//  - No bloquea si el stock no alcanza (puede quedar negativo) y acepta
//    decimales (metros de cable). El stock del local hoy no está al día, y
//    frenar el vale por eso sería sumar burocracia.

import {
  AuditAction,
  AuditEntityType,
  ExpenseSourceType,
  Prisma,
  TipoMovimientoStock,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";

export type TipoVale = "SALIDA" | "DEVOLUCION";

const REF: Record<TipoVale, string> = { SALIDA: "VALE_SALIDA", DEVOLUCION: "VALE_DEVOLUCION" };

export interface RenglonVale {
  materialItemId: string;
  cantidad: number;
}

export async function registrarValeObra(input: {
  projectId: string;
  tipo: TipoVale;
  fecha: Date;
  renglones: RenglonVale[];
  observaciones?: string | null;
  userId: string;
}): Promise<{ referencia: string; renglones: number }> {
  const { projectId, tipo, fecha, userId } = input;
  const renglones = input.renglones.filter((r) => Number.isFinite(r.cantidad) && r.cantidad > 0);
  if (!renglones.length) throw badRequest("VALE_VACIO", "El vale no tiene cantidades");

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe");

  const ids = [...new Set(renglones.map((r) => r.materialItemId))];
  const items = await prisma.materialItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, nombre: true, unidad: true, gestionaStock: true },
  });
  const porId = new Map(items.map((i) => [i.id, i]));
  const faltan = ids.filter((id) => !porId.has(id));
  if (faltan.length) throw notFound("MATERIAL_ITEM_NOT_FOUND", "Hay materiales que no existen en el catálogo");

  // Fecha y hora de Uruguay: es lo que se lee en el historial de movimientos.
  const ahora = new Date().toLocaleString("sv-SE", { timeZone: "America/Montevideo" }).slice(0, 16);
  const referencia = `${REF[tipo]} ${ahora}`;
  const tipoMov = tipo === "SALIDA" ? TipoMovimientoStock.EGRESO : TipoMovimientoStock.INGRESO;

  await prisma.$transaction(async (tx) => {
    for (const r of renglones) {
      const item = porId.get(r.materialItemId)!;
      // Se relee dentro de la transacción: dos renglones del mismo material
      // tienen que encadenar el stock.
      const actual = Number(
        (await tx.materialItem.findUniqueOrThrow({ where: { id: item.id }, select: { stockActual: true } }))
          .stockActual,
      );
      const resultante = item.gestionaStock
        ? tipo === "SALIDA"
          ? actual - r.cantidad
          : actual + r.cantidad
        : actual;

      await tx.stockMovement.create({
        data: {
          fecha,
          materialItemId: item.id,
          tipo: tipoMov,
          cantidad: new Prisma.Decimal(r.cantidad),
          stockResultante: new Prisma.Decimal(resultante),
          projectId,
          causaIngreso: tipo === "DEVOLUCION" ? ExpenseSourceType.OTRO : null,
          referencia,
          observaciones: input.observaciones ?? null,
        },
      });
      if (item.gestionaStock) {
        await tx.materialItem.update({
          where: { id: item.id },
          data: { stockActual: new Prisma.Decimal(resultante) },
        });
      }
    }
  });

  await createAuditEntry({
    entityType: AuditEntityType.stock_movement,
    entityId: projectId,
    projectId,
    userId,
    action: AuditAction.created,
    description: `${tipo === "SALIDA" ? "Vale de salida" : "Vale de devolución"} a obra: ${renglones.length} materiales`,
  });

  return { referencia, renglones: renglones.length };
}

export interface FilaConsumo {
  materialItemId: string;
  nombre: string;
  unidad: string;
  planificado: number;
  salio: number;
  volvio: number;
  /** salio − volvio */
  consumo: number;
}

/**
 * El consumo de una obra por material: lo planificado en la lista de
 * materiales, lo que salió y lo que volvió con los vales. Solo cuenta los
 * movimientos de vales (no los egresos sueltos de la pantalla de Stock ni los
 * ingresos por factura imputados a la obra).
 */
export async function consumoDeObra(projectId: string): Promise<FilaConsumo[]> {
  const [plan, movs] = await Promise.all([
    prisma.projectMaterial.findMany({
      where: { projectId, quantity: { gt: 0 } },
      select: { materialItemId: true, quantity: true },
    }),
    prisma.stockMovement.findMany({
      where: {
        projectId,
        reversed: false,
        OR: [{ referencia: { startsWith: REF.SALIDA } }, { referencia: { startsWith: REF.DEVOLUCION } }],
      },
      select: { materialItemId: true, tipo: true, cantidad: true },
    }),
  ]);

  const filas = new Map<string, { planificado: number; salio: number; volvio: number }>();
  const fila = (id: string) => {
    let f = filas.get(id);
    if (!f) filas.set(id, (f = { planificado: 0, salio: 0, volvio: 0 }));
    return f;
  };
  for (const p of plan) fila(p.materialItemId).planificado += Number(p.quantity);
  for (const m of movs) {
    if (m.tipo === TipoMovimientoStock.EGRESO) fila(m.materialItemId).salio += Number(m.cantidad);
    else if (m.tipo === TipoMovimientoStock.INGRESO) fila(m.materialItemId).volvio += Number(m.cantidad);
  }

  const items = await prisma.materialItem.findMany({
    where: { id: { in: [...filas.keys()] } },
    select: { id: true, nombre: true, unidad: true },
  });
  const porId = new Map(items.map((i) => [i.id, i]));

  return [...filas.entries()]
    .map(([id, f]) => ({
      materialItemId: id,
      nombre: porId.get(id)?.nombre ?? "(material borrado)",
      unidad: porId.get(id)?.unidad ?? "",
      ...f,
      consumo: f.salio - f.volvio,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
