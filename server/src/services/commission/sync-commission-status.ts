// Espejo del estado de la comisión desde el FinanceMovement linkeado.
// Finanzas es la fuente de verdad: cuando el movimiento pasa a PAGADO la comisión
// pasa a PAGADA (y a la inversa si se revierte). Se llama desde los handlers de
// transición / patch de movimientos.

import { AuditAction, AuditEntityType, CommissionStatus, FinanceMovementStatus, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";

// Acepta el cliente global o un cliente de transacción.
type Db = Prisma.TransactionClient | typeof prisma;

export async function syncCommissionFromMovement(
  db: Db,
  movementId: string,
  newStatus: FinanceMovementStatus,
  opts?: { paidDate?: Date | null; userId?: string },
): Promise<void> {
  const commission = await db.commission.findUnique({ where: { financeMovementId: movementId } });
  if (!commission) return;

  const isPaid = newStatus === FinanceMovementStatus.PAGADO;
  const nextStatus = isPaid ? CommissionStatus.PAGADA : CommissionStatus.PENDIENTE;
  if (commission.status === nextStatus) return;

  await db.commission.update({
    where: { id: commission.id },
    data: { status: nextStatus, paidAt: isPaid ? (opts?.paidDate ?? new Date()) : null },
  });

  if (isPaid && opts?.userId) {
    await createAuditEntry({
      entityType: AuditEntityType.commission,
      entityId: commission.id,
      userId: opts.userId,
      action: AuditAction.commission_paid,
      description: `Comisión marcada como pagada (movimiento ${movementId}).`,
      metadata: { financeMovementId: movementId },
    });
  }
}
