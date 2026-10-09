// Cuentas por pagar y bandeja de facturas recibidas de proveedores. Prefijo /api.
//
// Todo bajo FINANZAS: ver con VIEW, tocar la bandeja con EDIT (misma llave que
// cargar una factura a mano en /finance/supplier-invoices).

import {
  Action,
  AuditAction,
  AuditEntityType,
  CategoriaPrincipal,
  EstadoAprobacion,
  EstadoFacturaRecibida,
  FinanceMovementStatus,
  Module,
  MovementSourceType,
  Prisma,
  TipoMovimiento,
} from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import {
  billerConfigurado,
  buscarRazonSocial,
  esNotaCredito,
  getUltimaSync,
  normalizarRut,
  sincronizarYRegistrar,
  TIPO_CFE_LABEL,
} from "../services/biller/recibidos.service.js";
import { calcularVencimiento, getCuentasPorPagar } from "../services/finance/cuentas-por-pagar.service.js";
import { parseDateOnly, toDateOnlyString } from "../utils/dates.js";
import { AppError, badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const ver = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.VIEW)] };
const editar = { preHandler: [authenticate, authorize(Module.FINANZAS, Action.EDIT)] };

const etiquetaCfe = (tipo: number, serie: string, numero: number) =>
  `${TIPO_CFE_LABEL[tipo] ?? `CFE ${tipo}`} ${serie}-${numero}`;

export async function registerCuentasPorPagarRoutes(app: FastifyInstance) {
  app.get("/finance/cuentas-por-pagar", ver, async () => getCuentasPorPagar());

  // ── Bandeja ────────────────────────────────────────────────────────────────

  app.get("/finance/facturas-recibidas", ver, async (request) => {
    const { estado } = z
      .object({ estado: z.enum(["PENDIENTE", "CONFIRMADA", "DESCARTADA", "todas"]).default("PENDIENTE") })
      .parse(request.query);
    const filas = await prisma.facturaRecibida.findMany({
      where: estado === "todas" ? {} : { estado },
      include: {
        supplier: { select: { id: true, nombre: true, plazoCreditoDias: true } },
        movement: { select: { id: true, descripcion: true, status: true } },
      },
      orderBy: [{ fechaEmision: "desc" }, { numero: "desc" }],
      take: 300,
    });

    // Candidatas a "ya la cargaron a mano": mismo proveedor y moneda, sin
    // factura recibida vinculada, y el número o el monto coinciden.
    const pendientes = filas.filter((f) => f.estado === EstadoFacturaRecibida.PENDIENTE && f.supplierId);
    const candidatasPorFila = new Map<string, Array<{ id: string; descripcion: string; invoiceNumber: string | null; monto: number; fecha: string | null; status: FinanceMovementStatus }>>();
    if (pendientes.length > 0) {
      const movs = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.GASTO,
          supplierId: { in: [...new Set(pendientes.map((p) => p.supplierId!))] },
          facturaRecibida: null,
        },
        select: { id: true, supplierId: true, descripcion: true, invoiceNumber: true, monto: true, moneda: true, fecha: true, status: true },
      });
      for (const f of pendientes) {
        const total = Number(f.total);
        const c = movs
          .filter((m) => m.supplierId === f.supplierId && m.moneda === f.moneda)
          .filter((m) =>
            (m.invoiceNumber ?? "").replace(/\D/g, "").endsWith(String(f.numero)) ||
            Math.abs(Number(m.monto) - total) <= 0.01)
          .slice(0, 5)
          .map((m) => ({
            id: m.id, descripcion: m.descripcion, invoiceNumber: m.invoiceNumber,
            monto: Number(m.monto), fecha: toDateOnlyString(m.fecha), status: m.status,
          }));
        if (c.length > 0) candidatasPorFila.set(f.id, c);
      }
    }

    return {
      billerConfigurado: billerConfigurado(),
      ultimaSync: getUltimaSync(),
      facturas: filas.map((f) => {
        const vencimientoPorPlazo = f.supplier
          ? toDateOnlyString(calcularVencimiento(f.fechaEmision, f.supplier.plazoCreditoDias))
          : null;
        return {
          id: f.id,
          rutEmisor: f.rutEmisor,
          razonSocialEmisor: f.razonSocialEmisor,
          tipoCfe: f.tipoCfe,
          tipoLabel: TIPO_CFE_LABEL[f.tipoCfe] ?? `CFE ${f.tipoCfe}`,
          esNotaCredito: esNotaCredito(f.tipoCfe),
          serie: f.serie,
          numero: f.numero,
          fechaEmision: toDateOnlyString(f.fechaEmision),
          fechaVencimientoCfe: toDateOnlyString(f.fechaVencimiento),
          vencimientoPorPlazo,
          moneda: f.moneda,
          total: Number(f.total),
          totalIva: f.totalIva != null ? Number(f.totalIva) : null,
          enDgi: f.enDgi,
          enMail: f.enMail,
          estado: f.estado,
          motivoDescarte: f.motivoDescarte,
          supplier: f.supplier ? { id: f.supplier.id, nombre: f.supplier.nombre } : null,
          movement: f.movement,
          candidatas: candidatasPorFila.get(f.id) ?? [],
        };
      }),
    };
  });

  // ── Registro: todas las facturas de proveedores ─────────────────────────────
  //
  // Une las dos fuentes para que no falte ninguna: lo que llegó de la
  // facturación electrónica (en cualquier estado de la bandeja, con o sin
  // proveedor dado de alta) y lo que se cargó a mano sin comprobante electrónico.
  app.get("/finance/facturas-proveedores", ver, async (request) => {
    const q = z.object({
      // "" = todos · un supplierId · "sin-proveedor" · "rut:<rut>"
      proveedor: z.string().optional(),
      desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      origen: z.enum(["todas", "electronica", "manual"]).default("todas"),
      buscar: z.string().trim().optional(),
    }).parse(request.query);

    const rango = {
      ...(q.desde ? { gte: parseDateOnly(q.desde) } : {}),
      ...(q.hasta ? { lte: parseDateOnly(q.hasta) } : {}),
    };
    const hayRango = Object.keys(rango).length > 0;
    const prov = q.proveedor ?? "";
    const rutFiltro = prov.startsWith("rut:") ? prov.slice(4) : null;
    const supplierFiltro = prov && prov !== "sin-proveedor" && !rutFiltro ? prov : null;

    type Fila = {
      origen: "ELECTRONICA" | "MANUAL";
      id: string;
      fechaEmision: string | null;
      proveedor: { id: string; nombre: string } | null;
      rut: string | null;
      razonSocial: string | null;
      comprobante: string;
      descripcion: string | null;
      moneda: string;
      totalNeto: number | null;
      iva: number | null;
      total: number;
      saldo: number | null;
      vencimiento: string | null;
      estadoBandeja: EstadoFacturaRecibida | null;
      motivoDescarte: string | null;
      estadoPago: FinanceMovementStatus | null;
      enDgi: boolean;
      enMail: boolean;
      project: { id: string; code: string; clientName: string } | null;
    };
    const filas: Fila[] = [];

    const movSelect = {
      id: true, status: true, dueDate: true, monto: true, descripcion: true,
      project: { select: { id: true, code: true, clientName: true } },
      paymentApplications: { where: { payment: { deletedAt: null } }, select: { montoAplicado: true } },
    } as const;
    const saldoDe = (m: { monto: Prisma.Decimal; status: FinanceMovementStatus; paymentApplications: { montoAplicado: Prisma.Decimal }[] }) =>
      m.status === FinanceMovementStatus.PAGADO ? 0
        : Math.max(0, Number(m.monto) - m.paymentApplications.reduce((a, p) => a + Number(p.montoAplicado), 0));

    if (q.origen !== "manual") {
      const cfes = await prisma.facturaRecibida.findMany({
        where: {
          ...(hayRango ? { fechaEmision: rango } : {}),
          ...(supplierFiltro ? { supplierId: supplierFiltro } : {}),
          ...(prov === "sin-proveedor" ? { supplierId: null } : {}),
          ...(rutFiltro ? { rutEmisor: rutFiltro } : {}),
        },
        include: {
          supplier: { select: { id: true, nombre: true, plazoCreditoDias: true } },
          movement: { select: movSelect },
        },
        orderBy: [{ fechaEmision: "desc" }, { numero: "desc" }],
      });
      for (const f of cfes) {
        const nc = esNotaCredito(f.tipoCfe);
        const signo = nc ? -1 : 1;
        filas.push({
          origen: "ELECTRONICA",
          id: f.id,
          fechaEmision: toDateOnlyString(f.fechaEmision),
          proveedor: f.supplier ? { id: f.supplier.id, nombre: f.supplier.nombre } : null,
          rut: f.rutEmisor,
          razonSocial: f.razonSocialEmisor,
          comprobante: etiquetaCfe(f.tipoCfe, f.serie, f.numero),
          descripcion: f.movement?.descripcion ?? null,
          moneda: f.moneda,
          totalNeto: f.totalNeto != null ? signo * Number(f.totalNeto) : null,
          iva: f.totalIva != null ? signo * Number(f.totalIva) : null,
          total: signo * Number(f.total),
          saldo: f.movement ? saldoDe(f.movement) : null,
          vencimiento: toDateOnlyString(
            f.movement?.dueDate ??
            (f.supplier ? calcularVencimiento(f.fechaEmision, f.supplier.plazoCreditoDias) : f.fechaVencimiento),
          ),
          estadoBandeja: f.estado,
          motivoDescarte: f.motivoDescarte,
          estadoPago: f.movement?.status ?? null,
          enDgi: f.enDgi,
          enMail: f.enMail,
          project: f.movement?.project ?? null,
        });
      }
    }

    // Las cargadas a mano solo tienen proveedor dado de alta: con el filtro
    // "sin proveedor" o por un RUT desconocido no corresponde ninguna.
    if (q.origen !== "electronica" && prov !== "sin-proveedor") {
      let supplierIds: string[] | null = supplierFiltro ? [supplierFiltro] : null;
      if (rutFiltro) {
        const ss = await prisma.supplier.findMany({ where: { deletedAt: null, rut: { not: null } }, select: { id: true, rut: true } });
        supplierIds = ss.filter((x) => normalizarRut(x.rut) === rutFiltro).map((x) => x.id);
      }
      const manuales = await prisma.financeMovement.findMany({
        where: {
          deletedAt: null,
          tipoMovimiento: TipoMovimiento.GASTO,
          facturaRecibida: null,
          supplierId: supplierIds ? { in: supplierIds } : { not: null },
          status: { in: [
            FinanceMovementStatus.COMPROMETIDO, FinanceMovementStatus.A_PAGAR,
            FinanceMovementStatus.PARCIALMENTE_PAGADO, FinanceMovementStatus.PAGADO,
          ] },
          ...(hayRango ? { fecha: rango } : {}),
        },
        select: {
          ...movSelect, fecha: true, moneda: true, invoiceNumber: true,
          supplier: { select: { id: true, nombre: true, rut: true } },
        },
        orderBy: { fecha: "desc" },
      });
      for (const m of manuales) {
        filas.push({
          origen: "MANUAL",
          id: m.id,
          fechaEmision: toDateOnlyString(m.fecha),
          proveedor: m.supplier ? { id: m.supplier.id, nombre: m.supplier.nombre } : null,
          rut: m.supplier?.rut ?? null,
          razonSocial: null,
          comprobante: m.invoiceNumber ? `Nº ${m.invoiceNumber}` : "Sin número",
          descripcion: m.descripcion,
          moneda: m.moneda,
          totalNeto: null,
          iva: null,
          total: Number(m.monto),
          saldo: saldoDe(m),
          vencimiento: toDateOnlyString(m.dueDate),
          estadoBandeja: null,
          motivoDescarte: null,
          estadoPago: m.status,
          enDgi: false,
          enMail: false,
          project: m.project,
        });
      }
    }

    const texto = q.buscar?.toLowerCase();
    const filtradas = texto
      ? filas.filter((f) => [f.proveedor?.nombre, f.razonSocial, f.rut, f.comprobante, f.descripcion, f.project?.clientName]
          .some((x) => x?.toLowerCase().includes(texto)))
      : filas;
    filtradas.sort((a, b) => (b.fechaEmision ?? "").localeCompare(a.fechaEmision ?? ""));

    // Emisores que todavía no son proveedores, para el filtro y para darlos de alta.
    const sinAlta = await prisma.facturaRecibida.groupBy({
      by: ["rutEmisor"],
      where: { supplierId: null },
      _count: { _all: true },
    });
    const nombres = await prisma.facturaRecibida.findMany({
      where: { supplierId: null, razonSocialEmisor: { not: null } },
      select: { rutEmisor: true, razonSocialEmisor: true },
      distinct: ["rutEmisor"],
    });
    const nombrePorRut = new Map(nombres.map((n) => [n.rutEmisor, n.razonSocialEmisor]));

    const totales: Record<string, number> = {};
    for (const f of filtradas) {
      if (f.estadoBandeja === EstadoFacturaRecibida.DESCARTADA) continue;
      totales[f.moneda] = Math.round(((totales[f.moneda] ?? 0) + f.total) * 100) / 100;
    }

    return {
      facturas: filtradas,
      totales,
      emisoresSinAlta: sinAlta.map((e) => ({
        rut: e.rutEmisor, razonSocial: nombrePorRut.get(e.rutEmisor) ?? null, facturas: e._count._all,
      })),
    };
  });

  // Da de alta como proveedor a un emisor que solo existía en las facturas
  // recibidas, y le asigna las que estaban esperando en la bandeja.
  app.post("/finance/facturas-recibidas/crear-proveedor", editar, async (request) => {
    const user = ensureUser(request);
    const body = z.object({
      rut: z.string().min(1),
      nombre: z.string().trim().min(1).optional(),
    }).strict().parse(request.body);
    const rut = normalizarRut(body.rut);
    if (!rut) throw badRequest("RUT_INVALIDO", "RUT inválido");

    const existentes = await prisma.supplier.findMany({ where: { deletedAt: null, rut: { not: null } }, select: { id: true, nombre: true, rut: true } });
    const ya = existentes.find((s) => normalizarRut(s.rut) === rut);
    if (ya) throw badRequest("PROVEEDOR_YA_EXISTE", `Ese RUT ya es del proveedor ${ya.nombre}.`);

    const nombre = body.nombre
      ?? (await prisma.facturaRecibida.findFirst({ where: { rutEmisor: rut, razonSocialEmisor: { not: null } }, select: { razonSocialEmisor: true } }))?.razonSocialEmisor
      ?? (await buscarRazonSocial(rut));
    if (!nombre) throw badRequest("NOMBRE_REQUERIDO", "No se encontró el nombre de ese RUT: escribilo.");

    const supplier = await prisma.supplier.create({ data: { nombre, rut } });
    const asignadas = await prisma.facturaRecibida.updateMany({
      where: { rutEmisor: rut, supplierId: null },
      data: { supplierId: supplier.id },
    });
    await createAuditEntry({
      entityType: AuditEntityType.supplier,
      entityId: supplier.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Dio de alta al proveedor ${nombre} (RUT ${rut}) desde sus facturas recibidas`,
    });
    return { supplierId: supplier.id, nombre, facturasAsignadas: asignadas.count };
  });

  app.post("/finance/facturas-recibidas/sincronizar", editar, async () => {
    if (!billerConfigurado()) throw badRequest("BILLER_NO_CONFIGURADO", "Falta configurar la cuenta de Biller.");
    const r = await sincronizarYRegistrar();
    if (!r.ok) throw new AppError(502, "BILLER_ERROR", `Biller no respondió bien: ${r.error}`);
    return r;
  });

  async function cargarPendiente(id: string) {
    const f = await prisma.facturaRecibida.findUnique({ where: { id } });
    if (!f) throw notFound("FACTURA_RECIBIDA_NOT_FOUND", "Factura recibida no encontrada");
    if (f.estado !== EstadoFacturaRecibida.PENDIENTE) {
      throw badRequest("FACTURA_RECIBIDA_RESUELTA", "Esta factura ya fue confirmada o descartada.");
    }
    return f;
  }

  /**
   * El proveedor de la factura. Si se elige uno sin RUT, se le guarda el del
   * comprobante (así la próxima factura se reconoce sola). Si tiene otro RUT,
   * no es ese proveedor.
   */
  async function resolverProveedor(rutEmisor: string, supplierId: string, tx: Prisma.TransactionClient) {
    const s = await tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
    if (!s) throw notFound("SUPPLIER_NOT_FOUND", "Proveedor no encontrado");
    const rut = normalizarRut(s.rut);
    if (rut && rut !== rutEmisor) {
      throw badRequest("RUT_NO_COINCIDE", `${s.nombre} tiene el RUT ${s.rut}, y la factura es del RUT ${rutEmisor}.`);
    }
    if (!rut) await tx.supplier.update({ where: { id: s.id }, data: { rut: rutEmisor } });
    return s;
  }

  app.post("/finance/facturas-recibidas/:id/confirmar", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      supplierId: z.string().min(1).optional(),
      descripcion: z.string().min(1).optional(),
      projectId: z.string().min(1).nullable().optional(),
      fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).strict().parse(request.body ?? {});

    const f = await cargarPendiente(id);
    if (esNotaCredito(f.tipoCfe)) {
      throw badRequest(
        "NOTA_CREDITO_A_MANO",
        "Las notas de crédito todavía se registran a mano. Descartala indicando cómo se registró.",
      );
    }
    const supplierId = body.supplierId ?? f.supplierId;
    if (!supplierId) throw badRequest("SUPPLIER_REQUIRED", "Elegí a qué proveedor corresponde la factura.");

    const movement = await prisma.$transaction(async (tx) => {
      const s = await resolverProveedor(f.rutEmisor, supplierId, tx);
      // Vence según el plazo negociado con el proveedor, salvo que se indique otra fecha.
      const venc = body.fechaVencimiento
        ? parseDateOnly(body.fechaVencimiento)
        : calcularVencimiento(f.fechaEmision, s.plazoCreditoDias);
      const m = await tx.financeMovement.create({
        data: {
          tipoMovimiento: TipoMovimiento.GASTO,
          categoriaPrincipal: CategoriaPrincipal.PAGO_PROVEEDOR,
          status: FinanceMovementStatus.A_PAGAR,
          sourceType: MovementSourceType.MANUAL,
          estadoAprobacion: EstadoAprobacion.REGISTRADO,
          supplierId: s.id,
          projectId: body.projectId ?? null,
          descripcion: body.descripcion ?? etiquetaCfe(f.tipoCfe, f.serie, f.numero),
          monto: f.total,
          moneda: f.moneda,
          fecha: f.fechaEmision,
          dueDate: venc,
          invoiceNumber: `${f.serie}-${f.numero}`,
          mes: venc.getUTCMonth() + 1,
          anio: venc.getUTCFullYear(),
          pagado: false,
          impactaFlujo: true,
          creadoPorId: user.id,
        },
      });
      await tx.facturaRecibida.update({
        where: { id: f.id },
        data: {
          estado: EstadoFacturaRecibida.CONFIRMADA, supplierId: s.id, movementId: m.id,
          resueltaPorId: user.id, resueltaAt: new Date(),
        },
      });
      return { ...m, supplierNombre: s.nombre };
    });

    await createAuditEntry({
      entityType: AuditEntityType.factura_recibida,
      entityId: f.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Confirmó la factura recibida ${etiquetaCfe(f.tipoCfe, f.serie, f.numero)} de ${movement.supplierNombre} por ${Number(f.total)} ${f.moneda}`,
    });
    return { movementId: movement.id };
  });

  app.post("/finance/facturas-recibidas/:id/vincular", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { movementId } = z.object({ movementId: z.string().min(1) }).strict().parse(request.body);

    const f = await cargarPendiente(id);
    await prisma.$transaction(async (tx) => {
      const m = await tx.financeMovement.findFirst({
        where: { id: movementId, deletedAt: null },
        include: { facturaRecibida: { select: { id: true } } },
      });
      if (!m || !m.supplierId) throw notFound("MOVEMENT_NOT_FOUND", "Movimiento no encontrado");
      if (m.facturaRecibida) throw badRequest("MOVEMENT_YA_VINCULADO", "Ese movimiento ya está vinculado a otra factura recibida.");
      if (m.moneda !== f.moneda) throw badRequest("MONEDA_NO_COINCIDE", "La factura y el movimiento están en monedas distintas.");
      await resolverProveedor(f.rutEmisor, m.supplierId, tx);
      // Se completa lo que la carga manual no tenía; lo que tenía, se respeta.
      await tx.financeMovement.update({
        where: { id: m.id },
        data: { invoiceNumber: m.invoiceNumber ?? `${f.serie}-${f.numero}` },
      });
      await tx.facturaRecibida.update({
        where: { id: f.id },
        data: {
          estado: EstadoFacturaRecibida.CONFIRMADA, supplierId: m.supplierId, movementId: m.id,
          resueltaPorId: user.id, resueltaAt: new Date(),
        },
      });
    });
    await createAuditEntry({
      entityType: AuditEntityType.factura_recibida,
      entityId: f.id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Vinculó la factura recibida ${etiquetaCfe(f.tipoCfe, f.serie, f.numero)} a un movimiento ya cargado`,
    });
    return { ok: true };
  });

  app.post("/finance/facturas-recibidas/:id/descartar", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { motivo } = z.object({ motivo: z.string().trim().min(3) }).strict().parse(request.body);
    const f = await cargarPendiente(id);
    await prisma.facturaRecibida.update({
      where: { id: f.id },
      data: { estado: EstadoFacturaRecibida.DESCARTADA, motivoDescarte: motivo, resueltaPorId: user.id, resueltaAt: new Date() },
    });
    await createAuditEntry({
      entityType: AuditEntityType.factura_recibida,
      entityId: f.id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Descartó la factura recibida ${etiquetaCfe(f.tipoCfe, f.serie, f.numero)}: ${motivo}`,
    });
    return { ok: true };
  });

  app.post("/finance/facturas-recibidas/:id/reabrir", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const f = await prisma.facturaRecibida.findUnique({ where: { id } });
    if (!f) throw notFound("FACTURA_RECIBIDA_NOT_FOUND", "Factura recibida no encontrada");
    // Una confirmada tiene su deuda creada: se corrige desde el movimiento, no acá.
    if (f.estado !== EstadoFacturaRecibida.DESCARTADA) {
      throw badRequest("SOLO_DESCARTADAS", "Solo se puede volver a la bandeja una factura descartada.");
    }
    await prisma.facturaRecibida.update({
      where: { id },
      data: { estado: EstadoFacturaRecibida.PENDIENTE, motivoDescarte: null, resueltaPorId: null, resueltaAt: null },
    });
    await createAuditEntry({
      entityType: AuditEntityType.factura_recibida,
      entityId: id,
      userId: user.id,
      action: AuditAction.updated,
      description: `Volvió a la bandeja la factura recibida ${etiquetaCfe(f.tipoCfe, f.serie, f.numero)}`,
    });
    return { ok: true };
  });
}
