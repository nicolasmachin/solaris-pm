-- Agrega invoiceNumber (opcional) a FinanceMovement para guardar el número de
-- factura del proveedor cuando un movimiento representa una factura a pagar.
ALTER TABLE "finance_movements" ADD COLUMN "invoiceNumber" TEXT;
