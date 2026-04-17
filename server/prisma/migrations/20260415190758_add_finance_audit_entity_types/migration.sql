-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'supplier';
ALTER TYPE "AuditEntityType" ADD VALUE 'finance_movement';
ALTER TYPE "AuditEntityType" ADD VALUE 'finance_comprobante';
ALTER TYPE "AuditEntityType" ADD VALUE 'stock_product';
ALTER TYPE "AuditEntityType" ADD VALUE 'stock_movement';
ALTER TYPE "AuditEntityType" ADD VALUE 'exchange_rate';
