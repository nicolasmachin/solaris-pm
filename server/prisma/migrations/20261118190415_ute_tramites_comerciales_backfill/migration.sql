-- Los aumentos de potencia que ya se pidieron desde Voltia PM antes de que
-- existiera la sección Comercial: solo quedaba la fecha del primer pedido en
-- `ute_document_configs`. Se pasan como trámites "pedidos" para que la sección
-- no arranque vacía; quien los sigue los cierra a mano cuando UTE resuelva.
-- Hasta acá todos los pedidos fueron aumentos (el asunto de cada mail lo dice).
INSERT INTO "ute_tramites_comerciales"
  ("id", "projectId", "suministro", "tipo", "detalle", "estado", "solicitadoEl", "createdAt", "updatedAt")
SELECT
  'utc_' || md5(c."projectId" || ':' || c."suministro"),
  c."projectId",
  c."suministro",
  'AUMENTO',
  CASE WHEN COALESCE(TRIM(c."potSolicitada"), '') <> '' THEN 'a ' || TRIM(c."potSolicitada") || ' kW' END,
  'PEDIDO',
  c."aumentoPotenciaSentAt",
  NOW(),
  NOW()
FROM "ute_document_configs" c
JOIN "projects" p ON p."id" = c."projectId" AND p."deletedAt" IS NULL
WHERE c."aumentoPotenciaSentAt" IS NOT NULL;
