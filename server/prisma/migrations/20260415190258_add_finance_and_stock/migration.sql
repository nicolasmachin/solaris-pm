-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('USD', 'UYU');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'CHEQUE', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CRYPTO', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'GASTO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "CategoriaPrincipal" AS ENUM ('FIJO', 'VARIABLE', 'PROYECTO_ENTRADA', 'PROYECTO_SALIDA', 'COMPRA_STOCK', 'CONSUMO_STOCK', 'PAGO_PROVEEDOR', 'COBRO_CLIENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoAprobacion" AS ENUM ('BORRADOR', 'REGISTRADO', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'TICKET', 'PRESUPUESTO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE', 'PARCIALMENTE_PAGADO', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('INGRESO', 'EGRESO', 'AJUSTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Module" ADD VALUE 'FINANZAS';
ALTER TYPE "Module" ADD VALUE 'STOCK';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FINANZAS';

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "condicionPago" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_subcategories" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaPrincipal" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usdToUyu" DECIMAL(10,4) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_movements" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "tipoMovimiento" "TipoMovimiento" NOT NULL,
    "categoriaPrincipal" "CategoriaPrincipal" NOT NULL,
    "subcategoriaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "tipoCambio" DECIMAL(10,4),
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "cobrado" BOOLEAN NOT NULL DEFAULT false,
    "impactaFlujo" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "supplierId" TEXT,
    "observaciones" TEXT,
    "estadoAprobacion" "EstadoAprobacion" NOT NULL DEFAULT 'REGISTRADO',
    "archivoAdjuntoUrl" TEXT,
    "creadoPorId" TEXT,
    "aprobadoPorId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_payments" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "supplierId" TEXT,
    "comprobanteUrl" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_comprobantes" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "numero" TEXT,
    "tipo" "TipoComprobante" NOT NULL DEFAULT 'FACTURA',
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
    "movimientoId" TEXT,
    "origenEmail" TEXT,
    "archivoUrl" TEXT,
    "notas" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_comprobante_payments" (
    "id" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "referencia" TEXT,
    "comprobanteUrl" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_comprobante_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_approval_history" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "comentario" TEXT,
    "estadoAntes" "EstadoAprobacion" NOT NULL,
    "estadoDespues" "EstadoAprobacion" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_approval_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_approval_rules" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "categorias" TEXT[],
    "montoMinimo" DECIMAL(14,2),
    "montoMaximo" DECIMAL(14,2),
    "estadoResultante" "EstadoAprobacion" NOT NULL DEFAULT 'PENDIENTE_APROBACION',
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_approval_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_products" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "stockActual" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "stockMinimo" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "costoPromedio" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "costoUnitario" DECIMAL(14,2),
    "costoTotal" DECIMAL(14,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "stockResultante" DECIMAL(14,3) NOT NULL,
    "supplierId" TEXT,
    "projectId" TEXT,
    "financeMovementId" TEXT,
    "referencia" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_activo_idx" ON "suppliers"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "finance_subcategories_nombre_categoria_key" ON "finance_subcategories"("nombre", "categoria");

-- CreateIndex
CREATE INDEX "exchange_rates_date_idx" ON "exchange_rates"("date");

-- CreateIndex
CREATE INDEX "finance_movements_fecha_idx" ON "finance_movements"("fecha");

-- CreateIndex
CREATE INDEX "finance_movements_mes_anio_idx" ON "finance_movements"("mes", "anio");

-- CreateIndex
CREATE INDEX "finance_movements_projectId_idx" ON "finance_movements"("projectId");

-- CreateIndex
CREATE INDEX "finance_movements_categoriaPrincipal_idx" ON "finance_movements"("categoriaPrincipal");

-- CreateIndex
CREATE INDEX "finance_movements_estadoAprobacion_idx" ON "finance_movements"("estadoAprobacion");

-- CreateIndex
CREATE INDEX "finance_movements_tipoMovimiento_idx" ON "finance_movements"("tipoMovimiento");

-- CreateIndex
CREATE INDEX "finance_payments_movimientoId_idx" ON "finance_payments"("movimientoId");

-- CreateIndex
CREATE INDEX "finance_comprobantes_supplierId_idx" ON "finance_comprobantes"("supplierId");

-- CreateIndex
CREATE INDEX "finance_comprobantes_estado_idx" ON "finance_comprobantes"("estado");

-- CreateIndex
CREATE INDEX "finance_comprobantes_fechaVencimiento_idx" ON "finance_comprobantes"("fechaVencimiento");

-- CreateIndex
CREATE INDEX "finance_comprobante_payments_comprobanteId_idx" ON "finance_comprobante_payments"("comprobanteId");

-- CreateIndex
CREATE INDEX "finance_approval_history_movimientoId_idx" ON "finance_approval_history"("movimientoId");

-- CreateIndex
CREATE INDEX "finance_approval_history_userId_idx" ON "finance_approval_history"("userId");

-- CreateIndex
CREATE INDEX "stock_products_categoria_idx" ON "stock_products"("categoria");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_fecha_idx" ON "stock_movements"("fecha");

-- CreateIndex
CREATE INDEX "stock_movements_projectId_idx" ON "stock_movements"("projectId");

-- CreateIndex
CREATE INDEX "stock_movements_financeMovementId_idx" ON "stock_movements"("financeMovementId");

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "finance_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "finance_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_comprobantes" ADD CONSTRAINT "finance_comprobantes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_comprobantes" ADD CONSTRAINT "finance_comprobantes_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_comprobante_payments" ADD CONSTRAINT "finance_comprobante_payments_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "finance_comprobantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_approval_history" ADD CONSTRAINT "finance_approval_history_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "finance_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_approval_history" ADD CONSTRAINT "finance_approval_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "stock_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_financeMovementId_fkey" FOREIGN KEY ("financeMovementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
