-- =============================================================================
--  Unificación Stock + Materiales + InvoiceItem
-- =============================================================================
--  ATENCIÓN: esta migración borra los datos de `stock_products` y
--  `stock_movements` porque eran datos de prueba descartables. Después de
--  aplicarla, el stock arranca de cero y pasa a vivir dentro de
--  `material_items` (campo `stockActual`). Los movimientos de stock se
--  vinculan a `material_items` en lugar de `stock_products`, y la tabla
--  `stock_products` deja de existir.
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '[migration] ATENCIÓN: borrando datos de stock_products y stock_movements (datos de prueba descartables)';
END $$;

-- ─── Limpieza previa (datos de prueba) ──────────────────────────────────────
TRUNCATE TABLE "stock_movements" CASCADE;
TRUNCATE TABLE "stock_products" CASCADE;

-- ─── Enums nuevos ───────────────────────────────────────────────────────────
CREATE TYPE "ExpenseSourceType" AS ENUM ('FACTURA', 'DEVOLUCION_PROVEEDOR', 'AJUSTE_INVENTARIO', 'IMPORTACION_INICIAL', 'OTRO');

-- AuditEntityType: agregar 3 valores nuevos
ALTER TYPE "AuditEntityType" ADD VALUE 'material_category';
ALTER TYPE "AuditEntityType" ADD VALUE 'material_item';
ALTER TYPE "AuditEntityType" ADD VALUE 'invoice_item';

-- ─── material_items: campos de stock ────────────────────────────────────────
ALTER TABLE "material_items"
  ADD COLUMN "gestionaStock"     BOOLEAN        NOT NULL DEFAULT true,
  ADD COLUMN "stockActual"       DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "stockMinimo"       DECIMAL(10, 2),
  ADD COLUMN "ubicacionDeposito" TEXT;

CREATE INDEX "material_items_gestionaStock_idx" ON "material_items"("gestionaStock");

-- ─── finance_movements: desglose de factura ─────────────────────────────────
ALTER TABLE "finance_movements"
  ADD COLUMN "requiresItemDetail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasItemDetail"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "noTieneMateriales"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "depositoIngresoId"  TEXT;

-- ─── stock_movements: vincular a material_items + invoice_items ─────────────
-- 1) Soltar FK e índice viejos del productId
ALTER TABLE "stock_movements" DROP CONSTRAINT IF EXISTS "stock_movements_productId_fkey";
DROP INDEX IF EXISTS "stock_movements_productId_idx";

-- 2) Reemplazar productId por materialItemId
ALTER TABLE "stock_movements" DROP COLUMN "productId";
ALTER TABLE "stock_movements" ADD COLUMN "materialItemId" TEXT NOT NULL;

-- 3) Campos nuevos
ALTER TABLE "stock_movements"
  ADD COLUMN "invoiceItemId" TEXT,
  ADD COLUMN "causaIngreso"  "ExpenseSourceType",
  ADD COLUMN "reversed"      BOOLEAN NOT NULL DEFAULT false;

-- 4) Índices
CREATE INDEX "stock_movements_materialItemId_idx" ON "stock_movements"("materialItemId");
CREATE INDEX "stock_movements_reversed_idx"       ON "stock_movements"("reversed");
CREATE UNIQUE INDEX "stock_movements_invoiceItemId_key" ON "stock_movements"("invoiceItemId");

-- ─── invoice_items ──────────────────────────────────────────────────────────
CREATE TABLE "invoice_items" (
  "id"             TEXT NOT NULL,
  "movementId"     TEXT NOT NULL,
  "materialItemId" TEXT NOT NULL,
  "quantity"       DECIMAL(10, 2) NOT NULL,
  "unitPrice"      DECIMAL(12, 2) NOT NULL,
  "moneda"         "Moneda" NOT NULL DEFAULT 'USD',
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_items_movementId_idx"     ON "invoice_items"("movementId");
CREATE INDEX "invoice_items_materialItemId_idx" ON "invoice_items"("materialItemId");

-- ─── DROP stock_products (ya no se usa; los datos vivían en seed) ──────────
DROP TABLE "stock_products";

-- ─── FKs nuevas ─────────────────────────────────────────────────────────────
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_materialItemId_fkey"
  FOREIGN KEY ("materialItemId") REFERENCES "material_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_invoiceItemId_fkey"
  FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_movementId_fkey"
  FOREIGN KEY ("movementId") REFERENCES "finance_movements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_materialItemId_fkey"
  FOREIGN KEY ("materialItemId") REFERENCES "material_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
