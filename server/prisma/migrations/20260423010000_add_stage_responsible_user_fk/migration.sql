-- Agrega FK de responsable a Stage.
-- El campo legacy "responsibleName" se mantiene como texto de referencia
-- (marcado @deprecated en el schema); no se toca en esta migración.
-- Los registros existentes quedan con responsibleUserId NULL y deben ser
-- reasignados manualmente desde la UI.

ALTER TABLE "stages" ADD COLUMN "responsibleUserId" TEXT;

CREATE INDEX "stages_responsibleUserId_idx" ON "stages"("responsibleUserId");

ALTER TABLE "stages"
  ADD CONSTRAINT "stages_responsibleUserId_fkey"
  FOREIGN KEY ("responsibleUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
