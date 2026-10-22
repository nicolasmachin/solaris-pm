-- Proyectos que ya llevaban factura sin ninguna nota: se toman como facturación
-- normal (todo el presupuesto). Los que tienen nota quedan sin definir (null)
-- para que Finanzas cargue el monto. Idempotente.
UPDATE "projects" SET "facturacionNormal" = true
WHERE "llevaFactura" = true AND "facturacionNormal" IS NULL
  AND ("facturaNota" IS NULL OR btrim("facturaNota") = '');
