-- Edición admin de comisiones: registro de modificación + flag de fecha de pago manual.
ALTER TABLE "commissions" ADD COLUMN "editadoAt" TIMESTAMPTZ(6);
ALTER TABLE "commissions" ADD COLUMN "notaEdicion" TEXT;
ALTER TABLE "commissions" ADD COLUMN "dueDateManual" BOOLEAN NOT NULL DEFAULT false;
