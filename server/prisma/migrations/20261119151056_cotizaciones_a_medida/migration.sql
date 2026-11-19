-- CreateEnum
CREATE TYPE "CotizacionEstado" AS ENUM ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'cotizacion';

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "estado" "CotizacionEstado" NOT NULL DEFAULT 'BORRADOR',
    "leadId" TEXT,
    "contactoId" TEXT,
    "empresaId" TEXT,
    "projectId" TEXT,
    "clienteNombre" TEXT NOT NULL,
    "clienteDireccion" TEXT,
    "clienteCiudad" TEXT,
    "clienteTelefono" TEXT,
    "clienteEmail" TEXT,
    "fecha" DATE NOT NULL,
    "validaHasta" DATE NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "vendedorId" TEXT,
    "formaTrabajo" TEXT,
    "alcanceTitulo" TEXT,
    "alcanceTexto" TEXT,
    "items" JSONB NOT NULL,
    "ivaTasa" DECIMAL(5,2) NOT NULL DEFAULT 22,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "condicionesPago" TEXT,
    "plazoEntrega" TEXT,
    "incluye" TEXT,
    "noIncluye" TEXT,
    "observaciones" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articulos_venta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalle" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'un',
    "precio" DECIMAL(14,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "articulos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_numero_key" ON "cotizaciones"("numero");

-- CreateIndex
CREATE INDEX "cotizaciones_leadId_idx" ON "cotizaciones"("leadId");

-- CreateIndex
CREATE INDEX "cotizaciones_contactoId_idx" ON "cotizaciones"("contactoId");

-- CreateIndex
CREATE INDEX "cotizaciones_empresaId_idx" ON "cotizaciones"("empresaId");

-- CreateIndex
CREATE INDEX "cotizaciones_projectId_idx" ON "cotizaciones"("projectId");

-- CreateIndex
CREATE INDEX "cotizaciones_deletedAt_idx" ON "cotizaciones"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_anio_correlativo_key" ON "cotizaciones"("anio", "correlativo");

-- CreateIndex
CREATE INDEX "articulos_venta_activo_idx" ON "articulos_venta"("activo");

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_contactoId_fkey" FOREIGN KEY ("contactoId") REFERENCES "contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
