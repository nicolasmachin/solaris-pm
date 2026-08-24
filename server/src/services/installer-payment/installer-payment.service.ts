// Pagos de mano de obra a instaladores tercerizados.
//
// Espejo de `commission.service.ts` del lado del gasto. Al ganarse un proyecto se
// congela cuánto hay que pagarle al instalador —la mano de obra de la propuesta
// ganadora MÁS IVA, porque el instalador factura— y queda pendiente de que un
// admin le asigne a quién.
//
// Dos diferencias con las comisiones, ambas pedidas por negocio:
//
//  1. Admite pagos PARCIALES. El saldo se deriva de los movimientos, no se
//     guarda: `saldo = montoUsd − Σ(movimientos)`. Guardarlo sería una segunda
//     fuente de verdad que se desincroniza en cuanto alguien edita un movimiento
//     desde Finanzas.
//  2. El instalador se asigna A MANO. No es una simplificación: `Team` —los
//     equipos del calendario, que sí distinguen PROPIO de TERCERIZADO— no tiene
//     ninguna relación con `User`, así que no hay de dónde deducir qué persona
//     hizo la obra.
//
// Sobre el flujo de fondos: solo se crean movimientos por los pagos REALMENTE
// entregados (status PAGADO). El saldo pendiente se ve en la pantalla de
// instaladores pero no genera un movimiento PREVISTO. Es deliberado: un previsto
// por el total más un pagado por cada entrega contaría el gasto dos veces.

import {
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  FinanceMovementStatus,
  InstallerPaymentStatus,
  Moneda,
  Prisma,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import type { ProposalV2Snapshot } from "../proposal/schemas/snapshot.schema.js";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";

/**
 * IVA uruguayo. Duplicado a propósito del cotizador (`proposal/calculator.ts`):
 * importarlo desde ahí acoplaría el módulo de pagos al motor de propuestas por
 * una constante. Si algún día cambia la tasa, hay que tocar los dos.
 */
const IVA = 0.22;

/** Subcategoría de Finanzas donde caen estos pagos. Ya existía, no se crea. */
const SUBCAT_NOMBRE = "Mano de obra";
const SUBCAT_CATEGORIA = CategoriaPrincipal.PROYECTO_SALIDA;

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Monto a pagarle al instalador según la propuesta ganadora: la mano de obra del
 * cotizador más IVA.
 *
 * Devuelve `null` cuando el snapshot no la trae (propuestas viejas, o proyectos
 * cargados a mano sin propuesta v2). En ese caso el pago nace en 0 y marcado como
 * `origenManual`, para que se note que hay que cargarlo.
 */
export function readManoDeObraFromSnapshot(snapshot: Prisma.JsonValue): number | null {
  const snap = snapshot as unknown as ProposalV2Snapshot;
  const calc = snap?.calc as { manoDeObraUsdSinIva?: number } | undefined;
  const sinIva = calc?.manoDeObraUsdSinIva;
  if (typeof sinIva !== "number" || !Number.isFinite(sinIva) || sinIva <= 0) return null;
  return Math.round(sinIva * (1 + IVA) * 100) / 100;
}

// ─── Saldo y estado ──────────────────────────────────────────────────────────

export interface SaldoInstallerPayment {
  montoUsd: number;
  pagadoUsd: number;
  saldoUsd: number;
  status: InstallerPaymentStatus;
}

/**
 * Estado derivado de lo entregado. Único lugar donde se decide
 * PENDIENTE/PARCIAL/PAGADO — si esto se duplica, los estados divergen.
 *
 * Se compara con una tolerancia de un centavo: los montos son Decimal(14,2) pero
 * pasan por `Number` para sumarse, y sin margen un pago que salda exactamente el
 * total podía quedar en PARCIAL por un error de coma flotante.
 */
export function calcularSaldo(montoUsd: number, movimientos: Array<{ monto: Prisma.Decimal | number }>): SaldoInstallerPayment {
  const pagadoUsd = movimientos.reduce((acc, m) => acc + Number(m.monto), 0);
  const saldoUsd = redondear(montoUsd - pagadoUsd);

  let status: InstallerPaymentStatus;
  if (pagadoUsd <= 0.005) status = InstallerPaymentStatus.PENDIENTE;
  else if (saldoUsd <= 0.005) status = InstallerPaymentStatus.PAGADO;
  else status = InstallerPaymentStatus.PARCIAL;

  return {
    montoUsd,
    pagadoUsd: redondear(pagadoUsd),
    saldoUsd,
    status,
  };
}

/**
 * Redondeo a centavos. El `+ 0` no es decorativo: cuando el saldo da un
 * negativo infinitesimal (0.1 + 0.2 !== 0.3), `Math.round` devuelve `-0`, que se
 * imprimiría como "-US$ 0,00".
 */
function redondear(v: number): number {
  return Math.round(v * 100) / 100 + 0;
}

/** Relee los movimientos del pago y sincroniza `status` + `paidAt`. */
export async function recalcularStatus(paymentId: string): Promise<SaldoInstallerPayment> {
  const payment = await prisma.installerPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      montoUsd: true,
      paidAt: true,
      movimientos: { where: { deletedAt: null }, select: { monto: true, fecha: true } },
    },
  });
  if (!payment) throw notFound("INSTALLER_PAYMENT_NOT_FOUND", "El pago no existe");

  const saldo = calcularSaldo(Number(payment.montoUsd), payment.movimientos);

  // paidAt = fecha del último movimiento que lo dejó saldado. Se limpia si deja
  // de estar saldado (ej. se borró un pago o se subió el monto).
  const ultimaFecha = payment.movimientos.reduce<Date | null>(
    (max, m) => (max === null || m.fecha > max ? m.fecha : max),
    null,
  );
  const paidAt = saldo.status === InstallerPaymentStatus.PAGADO ? (ultimaFecha ?? new Date()) : null;

  await prisma.installerPayment.update({
    where: { id: paymentId },
    data: { status: saldo.status, paidAt },
  });

  return saldo;
}

// ─── Serialización ───────────────────────────────────────────────────────────

export interface SerializedInstallerPayment {
  id: string;
  projectId: string | null;
  projectCode: string | null;
  clientName: string;
  concepto: string | null;
  installerId: string | null;
  installerName: string | null;
  montoUsd: number;
  pagadoUsd: number;
  saldoUsd: number;
  origenManual: boolean;
  montoEditado: boolean;
  fechaTrabajo: string;
  dueDate: string;
  status: InstallerPaymentStatus;
  paidAt: string | null;
  notas: string | null;
  pagos: Array<{
    id: string;
    fecha: string;
    montoUsd: number;
    descripcion: string;
  }>;
  createdAt: string;
}

type PaymentWithRelations = Prisma.InstallerPaymentGetPayload<{
  include: {
    project: { select: { code: true; clientName: true } };
    installer: { select: { name: true } };
    movimientos: true;
  };
}>;

export function serializeInstallerPayment(p: PaymentWithRelations): SerializedInstallerPayment {
  const vivos = p.movimientos.filter((m) => m.deletedAt === null);
  const saldo = calcularSaldo(Number(p.montoUsd), vivos);

  return {
    id: p.id,
    projectId: p.projectId,
    projectCode: p.project?.code ?? null,
    // Para los pagos manuales (sin proyecto) se muestra el concepto, igual que
    // hacen las comisiones manuales con su etiqueta libre.
    clientName: p.project?.clientName ?? p.concepto ?? "Pago manual",
    concepto: p.concepto,
    installerId: p.installerId,
    installerName: p.installer?.name ?? null,
    montoUsd: saldo.montoUsd,
    pagadoUsd: saldo.pagadoUsd,
    saldoUsd: saldo.saldoUsd,
    origenManual: p.origenManual,
    montoEditado: p.montoEditado,
    fechaTrabajo: p.fechaTrabajo.toISOString(),
    dueDate: p.dueDate.toISOString(),
    status: p.status,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    notas: p.notas,
    pagos: vivos
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
      .map((m) => ({
        id: m.id,
        fecha: m.fecha.toISOString(),
        montoUsd: Number(m.monto),
        descripcion: m.descripcion,
      })),
    createdAt: p.createdAt.toISOString(),
  };
}

const INCLUDE_FULL = {
  project: { select: { code: true, clientName: true } },
  installer: { select: { name: true } },
  movimientos: true,
} satisfies Prisma.InstallerPaymentInclude;

// ─── Congelamiento al ganar el proyecto ──────────────────────────────────────

/** Primer día del mes siguiente, con aritmética de meses (no rompe en día 31). */
function firstDayOfNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export interface CreateForProjectResult {
  payment: SerializedInstallerPayment;
  created: boolean;
}

/**
 * Crea el pago al instalador de un proyecto recién ganado. **Idempotente**: si ya
 * existe uno lo devuelve sin tocarlo, para que reintentar la conversión de un
 * lead no duplique la deuda.
 *
 * Nace SIN instalador asignado: quién hizo la obra se decide después, a mano.
 */
export async function createInstallerPaymentForProject(input: {
  projectId: string;
  userId: string;
  leadId?: string | null;
}): Promise<CreateForProjectResult> {
  const { projectId, userId } = input;

  const existing = await prisma.installerPayment.findUnique({
    where: { projectId },
    include: INCLUDE_FULL,
  });
  if (existing) return { payment: serializeInstallerPayment(existing), created: false };

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, clientName: true, saleDate: true, startDate: true },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe");

  // Monto congelado de la propuesta ganadora. Se busca la última publicada del
  // lead que originó el proyecto.
  let montoUsd = 0;
  let proposalVersionId: string | null = null;
  let origenManual = true;

  const leadId =
    input.leadId ??
    (
      await prisma.salesLead.findFirst({
        where: { convertedToProjectId: projectId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id ??
    null;

  if (leadId) {
    const version = await prisma.proposalV2Version.findFirst({
      where: { leadId, status: "PUBLISHED" },
      orderBy: { versionNumber: "desc" },
      select: { id: true, snapshot: true },
    });
    const monto = version ? readManoDeObraFromSnapshot(version.snapshot) : null;
    if (monto != null) {
      montoUsd = monto;
      proposalVersionId = version!.id;
      origenManual = false;
    }
  }

  const fechaTrabajo = project.saleDate ?? project.startDate ?? new Date();

  const payment = await prisma.installerPayment.create({
    data: {
      projectId,
      montoUsd: new Prisma.Decimal(montoUsd),
      proposalVersionId,
      origenManual,
      fechaTrabajo,
      dueDate: firstDayOfNextMonth(fechaTrabajo),
      status: InstallerPaymentStatus.PENDIENTE,
      createdById: userId,
    },
    include: INCLUDE_FULL,
  });

  await createAuditEntry({
    entityType: AuditEntityType.installer_payment,
    entityId: payment.id,
    projectId,
    userId,
    action: AuditAction.created,
    description: origenManual
      ? `Pago a instalador creado para ${project.clientName} — sin monto (la propuesta no tiene mano de obra)`
      : `Pago a instalador congelado para ${project.clientName} (USD ${montoUsd.toFixed(2)} con IVA)`,
    metadata: { origenManual, proposalVersionId },
  });

  return { payment: serializeInstallerPayment(payment), created: true };
}

// ─── Carga manual (admin) ────────────────────────────────────────────────────

export async function createManualInstallerPayment(input: {
  installerId: string | null;
  projectId?: string | null;
  concepto?: string | null;
  montoUsd: number;
  fechaTrabajo: Date;
  userId: string;
}): Promise<SerializedInstallerPayment> {
  if (!(input.montoUsd > 0)) {
    throw badRequest("MONTO_INVALIDO", "El monto tiene que ser mayor a 0.");
  }
  if (!input.projectId && !input.concepto?.trim()) {
    throw badRequest("CONCEPTO_REQUERIDO", "Sin proyecto hay que poner un concepto.");
  }
  if (input.projectId) {
    const yaHay = await prisma.installerPayment.findUnique({ where: { projectId: input.projectId } });
    if (yaHay) {
      throw badRequest("YA_EXISTE", "Ese proyecto ya tiene un pago a instalador cargado.");
    }
  }

  const payment = await prisma.installerPayment.create({
    data: {
      projectId: input.projectId ?? null,
      concepto: input.concepto?.trim() || null,
      installerId: input.installerId,
      montoUsd: new Prisma.Decimal(input.montoUsd),
      origenManual: true,
      fechaTrabajo: input.fechaTrabajo,
      dueDate: firstDayOfNextMonth(input.fechaTrabajo),
      status: InstallerPaymentStatus.PENDIENTE,
      createdById: input.userId,
    },
    include: INCLUDE_FULL,
  });

  await createAuditEntry({
    entityType: AuditEntityType.installer_payment,
    entityId: payment.id,
    projectId: input.projectId ?? undefined,
    userId: input.userId,
    action: AuditAction.created,
    description: `Pago a instalador cargado a mano (USD ${input.montoUsd.toFixed(2)})`,
  });

  return serializeInstallerPayment(payment);
}

// ─── Asignación y edición ────────────────────────────────────────────────────

export async function updateInstallerPayment(input: {
  paymentId: string;
  userId: string;
  installerId?: string | null;
  montoUsd?: number;
  fechaTrabajo?: Date;
  dueDate?: Date;
  notas?: string;
}): Promise<SerializedInstallerPayment> {
  const actual = await prisma.installerPayment.findFirst({
    where: { id: input.paymentId, deletedAt: null },
    include: INCLUDE_FULL,
  });
  if (!actual) throw notFound("INSTALLER_PAYMENT_NOT_FOUND", "El pago no existe");

  if (input.montoUsd != null && !(input.montoUsd > 0)) {
    throw badRequest("MONTO_INVALIDO", "El monto tiene que ser mayor a 0.");
  }

  // Bajar el monto por debajo de lo ya entregado dejaría un saldo negativo.
  if (input.montoUsd != null) {
    const pagado = actual.movimientos
      .filter((m) => m.deletedAt === null)
      .reduce((a, m) => a + Number(m.monto), 0);
    if (input.montoUsd + 0.005 < pagado) {
      throw badRequest(
        "MONTO_MENOR_A_PAGADO",
        `El monto no puede ser menor a lo ya pagado (USD ${pagado.toFixed(2)}).`,
      );
    }
  }

  if (input.installerId) {
    const installer = await prisma.user.findFirst({
      where: { id: input.installerId, deletedAt: null },
      select: { id: true },
    });
    if (!installer) throw badRequest("INSTALLER_NOT_FOUND", "El instalador no existe.");
  }

  const montoCambio = input.montoUsd != null && input.montoUsd !== Number(actual.montoUsd);

  await prisma.installerPayment.update({
    where: { id: input.paymentId },
    data: {
      ...(input.installerId !== undefined ? { installerId: input.installerId } : {}),
      ...(input.montoUsd != null
        ? { montoUsd: new Prisma.Decimal(input.montoUsd), montoEditado: true }
        : {}),
      ...(input.fechaTrabajo ? { fechaTrabajo: input.fechaTrabajo } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.notas !== undefined ? { notas: input.notas.trim() || null } : {}),
    },
  });

  // Cambiar el monto puede cambiar el estado (ej. subirlo deja de estar saldado).
  await recalcularStatus(input.paymentId);

  const cambios: string[] = [];
  if (input.installerId !== undefined) cambios.push("instalador asignado");
  if (montoCambio) cambios.push(`monto → USD ${input.montoUsd!.toFixed(2)}`);
  if (input.fechaTrabajo) cambios.push("fecha de trabajo");
  if (input.dueDate) cambios.push("fecha de pago");

  await createAuditEntry({
    entityType: AuditEntityType.installer_payment,
    entityId: input.paymentId,
    projectId: actual.projectId ?? undefined,
    userId: input.userId,
    action: AuditAction.updated,
    description: `Pago a instalador actualizado${cambios.length ? `: ${cambios.join(", ")}` : ""}`,
  });

  const fresh = await prisma.installerPayment.findUniqueOrThrow({
    where: { id: input.paymentId },
    include: INCLUDE_FULL,
  });
  return serializeInstallerPayment(fresh);
}

// ─── Pagos parciales ─────────────────────────────────────────────────────────

export async function registrarPago(input: {
  paymentId: string;
  montoUsd: number;
  fecha: Date;
  accountId?: string | null;
  notas?: string | null;
  userId: string;
}): Promise<SerializedInstallerPayment> {
  const payment = await prisma.installerPayment.findFirst({
    where: { id: input.paymentId, deletedAt: null },
    include: { ...INCLUDE_FULL, project: { select: { code: true, clientName: true } } },
  });
  if (!payment) throw notFound("INSTALLER_PAYMENT_NOT_FOUND", "El pago no existe");
  if (!payment.installerId) {
    throw badRequest("SIN_INSTALADOR", "Asigná primero a qué instalador se le paga.");
  }
  if (!(input.montoUsd > 0)) {
    throw badRequest("MONTO_INVALIDO", "El monto tiene que ser mayor a 0.");
  }

  const vivos = payment.movimientos.filter((m) => m.deletedAt === null);
  const saldoActual = calcularSaldo(Number(payment.montoUsd), vivos).saldoUsd;
  if (input.montoUsd > saldoActual + 0.005) {
    throw badRequest(
      "SUPERA_EL_SALDO",
      `El pago supera el saldo pendiente (USD ${saldoActual.toFixed(2)}).`,
    );
  }

  const subcat = await prisma.financeSubcategory.upsert({
    where: { nombre_categoria: { nombre: SUBCAT_NOMBRE, categoria: SUBCAT_CATEGORIA } },
    create: { nombre: SUBCAT_NOMBRE, categoria: SUBCAT_CATEGORIA },
    update: {},
  });

  const quien = payment.installer?.name ?? "instalador";
  const obra = payment.project?.clientName ?? payment.concepto ?? "trabajo";

  await prisma.financeMovement.create({
    data: {
      fecha: input.fecha,
      mes: input.fecha.getUTCMonth() + 1,
      anio: input.fecha.getUTCFullYear(),
      tipoMovimiento: TipoMovimiento.GASTO,
      categoriaPrincipal: SUBCAT_CATEGORIA,
      subcategoriaId: subcat.id,
      descripcion: `Mano de obra ${obra} — ${quien}`,
      monto: new Prisma.Decimal(input.montoUsd),
      moneda: Moneda.USD,
      // El movimiento representa plata que YA salió, no una previsión.
      status: FinanceMovementStatus.PAGADO,
      pagado: true,
      impactaFlujo: true,
      accountId: input.accountId ?? null,
      projectId: payment.projectId,
      installerPaymentId: payment.id,
      creadoPorId: input.userId,
      observaciones: input.notas?.trim() || null,
    },
  });

  const saldo = await recalcularStatus(payment.id);

  await createAuditEntry({
    entityType: AuditEntityType.installer_payment,
    entityId: payment.id,
    projectId: payment.projectId ?? undefined,
    userId: input.userId,
    action: AuditAction.updated,
    description: `Pago de USD ${input.montoUsd.toFixed(2)} a ${quien} — saldo USD ${saldo.saldoUsd.toFixed(2)}`,
    metadata: { montoUsd: input.montoUsd, saldoUsd: saldo.saldoUsd, status: saldo.status },
  });

  const fresh = await prisma.installerPayment.findUniqueOrThrow({
    where: { id: payment.id },
    include: INCLUDE_FULL,
  });
  return serializeInstallerPayment(fresh);
}

// ─── Editar / borrar una entrega registrada ──────────────────────────────────
//
// Una "entrega" es el FinanceMovement que generó `registrarPago`. Corregir o
// anular una entrega opera DIRECTAMENTE sobre ese movimiento, así el cambio se
// refleja en Finanzas (Movimientos, flujo, estado de resultados) sin duplicar
// lógica, y `recalcularStatus` reajusta el saldo/estado del pago al instalador.

/** Busca la entrega (movimiento vivo) que pertenece a este pago, o tira 404. */
async function findEntregaOrThrow(paymentId: string, movementId: string) {
  const payment = await prisma.installerPayment.findFirst({
    where: { id: paymentId, deletedAt: null },
    include: INCLUDE_FULL,
  });
  if (!payment) throw notFound("INSTALLER_PAYMENT_NOT_FOUND", "El pago no existe");
  const mov = payment.movimientos.find((m) => m.id === movementId && m.deletedAt === null);
  if (!mov) {
    throw notFound("ENTREGA_NOT_FOUND", "La entrega no existe o no pertenece a este pago.");
  }
  return { payment, mov };
}

export async function editarEntrega(input: {
  paymentId: string;
  movementId: string;
  userId: string;
  montoUsd?: number;
  fecha?: Date;
  notas?: string;
}): Promise<SerializedInstallerPayment> {
  const { payment, mov } = await findEntregaOrThrow(input.paymentId, input.movementId);

  if (input.montoUsd != null && !(input.montoUsd > 0)) {
    throw badRequest("MONTO_INVALIDO", "El monto tiene que ser mayor a 0.");
  }
  // La suma de todas las entregas no puede superar el monto del trabajo.
  if (input.montoUsd != null) {
    const otras = payment.movimientos
      .filter((m) => m.deletedAt === null && m.id !== mov.id)
      .reduce((a, m) => a + Number(m.monto), 0);
    if (otras + input.montoUsd > Number(payment.montoUsd) + 0.005) {
      throw badRequest(
        "SUPERA_EL_MONTO",
        `El total entregado no puede superar el monto del trabajo (USD ${Number(payment.montoUsd).toFixed(2)}).`,
      );
    }
  }

  const data: Prisma.FinanceMovementUpdateInput = {};
  if (input.montoUsd != null) data.monto = new Prisma.Decimal(input.montoUsd);
  if (input.fecha) {
    data.fecha = input.fecha;
    data.mes = input.fecha.getUTCMonth() + 1;
    data.anio = input.fecha.getUTCFullYear();
  }
  if (input.notas !== undefined) data.observaciones = input.notas.trim() || null;

  await prisma.financeMovement.update({ where: { id: mov.id }, data });
  await recalcularStatus(payment.id);

  await createAuditEntry({
    entityType: AuditEntityType.installer_payment,
    entityId: payment.id,
    projectId: payment.projectId ?? undefined,
    userId: input.userId,
    action: AuditAction.updated,
    description:
      input.montoUsd != null
        ? `Entrega a instalador corregida → USD ${input.montoUsd.toFixed(2)}`
        : "Entrega a instalador corregida",
  });

  const fresh = await prisma.installerPayment.findUniqueOrThrow({
    where: { id: payment.id },
    include: INCLUDE_FULL,
  });
  return serializeInstallerPayment(fresh);
}

export async function borrarEntrega(input: {
  paymentId: string;
  movementId: string;
  userId: string;
}): Promise<SerializedInstallerPayment> {
  const { payment, mov } = await findEntregaOrThrow(input.paymentId, input.movementId);

  // Soft-delete del movimiento: sale de Finanzas y el saldo del pago se recalcula.
  await prisma.financeMovement.update({
    where: { id: mov.id },
    data: { deletedAt: new Date() },
  });
  await recalcularStatus(payment.id);

  await createAuditEntry({
    entityType: AuditEntityType.installer_payment,
    entityId: payment.id,
    projectId: payment.projectId ?? undefined,
    userId: input.userId,
    action: AuditAction.deleted,
    description: `Entrega a instalador anulada (USD ${Number(mov.monto).toFixed(2)})`,
  });

  const fresh = await prisma.installerPayment.findUniqueOrThrow({
    where: { id: payment.id },
    include: INCLUDE_FULL,
  });
  return serializeInstallerPayment(fresh);
}

// ─── Listado y métricas ──────────────────────────────────────────────────────

export interface ListFilter {
  installerId?: string;
  status?: InstallerPaymentStatus;
  year?: number;
  /** true = solo los que todavía no tienen instalador (vista del admin). */
  sinAsignar?: boolean;
}

export async function listInstallerPayments(filter: ListFilter): Promise<SerializedInstallerPayment[]> {
  const where: Prisma.InstallerPaymentWhereInput = { deletedAt: null };
  if (filter.installerId) where.installerId = filter.installerId;
  if (filter.sinAsignar) where.installerId = null;
  if (filter.status) where.status = filter.status;
  if (filter.year) {
    where.fechaTrabajo = {
      gte: new Date(Date.UTC(filter.year, 0, 1)),
      lt: new Date(Date.UTC(filter.year + 1, 0, 1)),
    };
  }

  const rows = await prisma.installerPayment.findMany({
    where,
    orderBy: { fechaTrabajo: "desc" },
    include: INCLUDE_FULL,
  });
  return rows.map(serializeInstallerPayment);
}

export interface InstallerPaymentMetrics {
  totalUsd: number;
  pagadoUsd: number;
  saldoUsd: number;
  trabajos: number;
  sinAsignar: number;
}

export async function installerPaymentMetrics(filter: {
  installerId?: string;
  year: number;
}): Promise<InstallerPaymentMetrics> {
  const where: Prisma.InstallerPaymentWhereInput = {
    deletedAt: null,
    fechaTrabajo: {
      gte: new Date(Date.UTC(filter.year, 0, 1)),
      lt: new Date(Date.UTC(filter.year + 1, 0, 1)),
    },
  };
  if (filter.installerId) where.installerId = filter.installerId;

  const rows = await prisma.installerPayment.findMany({
    where,
    select: {
      montoUsd: true,
      installerId: true,
      movimientos: { where: { deletedAt: null }, select: { monto: true } },
    },
  });

  let totalUsd = 0;
  let pagadoUsd = 0;
  let sinAsignar = 0;
  for (const r of rows) {
    const saldo = calcularSaldo(Number(r.montoUsd), r.movimientos);
    totalUsd += saldo.montoUsd;
    pagadoUsd += saldo.pagadoUsd;
    if (!r.installerId) sinAsignar++;
  }

  return {
    totalUsd: Math.round(totalUsd * 100) / 100,
    pagadoUsd: Math.round(pagadoUsd * 100) / 100,
    saldoUsd: Math.round((totalUsd - pagadoUsd) * 100) / 100,
    trabajos: rows.length,
    sinAsignar,
  };
}

// ─── Borrado ─────────────────────────────────────────────────────────────────

/**
 * Borrado suave. Los movimientos de Finanzas **no se tocan**: son plata que
 * realmente salió y borrarlos descuadraría las cuentas. Si hay que revertir un
 * pago, se hace desde Finanzas.
 */
export async function deleteInstallerPayment(input: {
  paymentId: string;
  userId: string;
}): Promise<void> {
  const payment = await prisma.installerPayment.findFirst({
    where: { id: input.paymentId, deletedAt: null },
    select: { id: true, projectId: true, movimientos: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!payment) throw notFound("INSTALLER_PAYMENT_NOT_FOUND", "El pago no existe");

  if (payment.movimientos.length > 0) {
    throw badRequest(
      "TIENE_PAGOS",
      "Este pago ya tiene entregas registradas. Anulá los movimientos desde Finanzas antes de borrarlo.",
    );
  }

  await prisma.installerPayment.update({
    where: { id: input.paymentId },
    data: { deletedAt: new Date() },
  });

  await createAuditEntry({
    entityType: AuditEntityType.installer_payment,
    entityId: input.paymentId,
    projectId: payment.projectId ?? undefined,
    userId: input.userId,
    action: AuditAction.deleted,
    description: "Pago a instalador eliminado",
  });
}
