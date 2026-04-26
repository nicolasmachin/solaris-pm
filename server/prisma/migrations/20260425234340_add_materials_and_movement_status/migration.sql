-- CreateEnum
CREATE TYPE "FinanceMovementStatus" AS ENUM ('PREVISTO', 'COMPROMETIDO', 'A_PAGAR', 'PAGADO');

-- CreateEnum
CREATE TYPE "MovementSourceType" AS ENUM ('MANUAL', 'PROJECT_MATERIALS');

-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN     "dueDate" DATE,
ADD COLUMN     "expectedDate" DATE,
ADD COLUMN     "materialItemId" TEXT,
ADD COLUMN     "quantity" DECIMAL(10,2),
ADD COLUMN     "sourceType" "MovementSourceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "status" "FinanceMovementStatus" NOT NULL DEFAULT 'PAGADO',
ADD COLUMN     "unitPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "contactoNombre" TEXT,
ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "rut" TEXT;

-- CreateTable
CREATE TABLE "material_categories" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_items" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'un',
    "precioSugerido" DECIMAL(12,2),
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "defaultSupplierId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_materials" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "materialItemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'USD',
    "supplierId" TEXT,
    "notes" TEXT,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_categories_nombre_key" ON "material_categories"("nombre");

-- CreateIndex
CREATE INDEX "material_categories_activa_idx" ON "material_categories"("activa");

-- CreateIndex
CREATE INDEX "material_categories_orden_idx" ON "material_categories"("orden");

-- CreateIndex
CREATE INDEX "material_items_categoryId_idx" ON "material_items"("categoryId");

-- CreateIndex
CREATE INDEX "material_items_activo_idx" ON "material_items"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "project_materials_movementId_key" ON "project_materials"("movementId");

-- CreateIndex
CREATE INDEX "project_materials_projectId_idx" ON "project_materials"("projectId");

-- CreateIndex
CREATE INDEX "project_materials_materialItemId_idx" ON "project_materials"("materialItemId");

-- CreateIndex
CREATE INDEX "finance_movements_status_idx" ON "finance_movements"("status");

-- CreateIndex
CREATE INDEX "finance_movements_sourceType_idx" ON "finance_movements"("sourceType");

-- CreateIndex
CREATE INDEX "finance_movements_dueDate_idx" ON "finance_movements"("dueDate");

-- AddForeignKey
ALTER TABLE "finance_movements" ADD CONSTRAINT "finance_movements_materialItemId_fkey" FOREIGN KEY ("materialItemId") REFERENCES "material_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_items" ADD CONSTRAINT "material_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "material_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_items" ADD CONSTRAINT "material_items_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_materialItemId_fkey" FOREIGN KEY ("materialItemId") REFERENCES "material_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "finance_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
