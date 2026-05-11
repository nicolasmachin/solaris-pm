-- Lista colaborativa de materiales: estado de compra/recepción, tachado,
-- color de fila, addedBy + audit liviano de última edición.

CREATE TYPE "MaterialStatus" AS ENUM ('PENDIENTE', 'PEDIDO', 'RECIBIDO', 'EN_STOCK');

ALTER TABLE "project_materials"
  ADD COLUMN "status" "MaterialStatus" NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "crossed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rowColor" TEXT,
  ADD COLUMN "addedById" TEXT,
  ADD COLUMN "lastEditedAt" TIMESTAMP(3),
  ADD COLUMN "lastEditedById" TEXT,
  ADD COLUMN "lastEditedRole" TEXT;

ALTER TABLE "project_materials"
  ADD CONSTRAINT "project_materials_addedById_fkey"
  FOREIGN KEY ("addedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_materials"
  ADD CONSTRAINT "project_materials_lastEditedById_fkey"
  FOREIGN KEY ("lastEditedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "project_materials_status_idx" ON "project_materials" ("status");
