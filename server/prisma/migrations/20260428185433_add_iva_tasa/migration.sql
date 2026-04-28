-- AlterTable
ALTER TABLE "finance_movements" ADD COLUMN     "ivaTasa" DOUBLE PRECISION DEFAULT 22.0;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "ivaTasa" DOUBLE PRECISION NOT NULL DEFAULT 22.0;

-- AlterTable
ALTER TABLE "material_items" ADD COLUMN     "ivaTasa" DOUBLE PRECISION NOT NULL DEFAULT 22.0;

-- AlterTable
ALTER TABLE "project_materials" ADD COLUMN     "ivaTasa" DOUBLE PRECISION NOT NULL DEFAULT 22.0;
