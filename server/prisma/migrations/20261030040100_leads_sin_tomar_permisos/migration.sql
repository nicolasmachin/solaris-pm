-- Quién puede tomar un lead sin vendedor (y recibe el aviso cuando entra uno):
-- los comerciales y administración. Va aparte porque Postgres no deja usar un
-- valor de enum en la misma transacción que lo agrega. Después se ajusta desde
-- la matriz; re-correr no pisa nada.
INSERT INTO "permissions" ("id", "roleId", "module", "action")
SELECT md5(random()::text || r."id" || 'TOMAR_LEAD'), r."id", 'VENTAS'::"Module", 'TOMAR_LEAD'::"Action"
FROM "roles" r
WHERE r."name" IN ('ADMIN', 'ASESOR_COMERCIAL', 'GERENTE_COMERCIAL')
ON CONFLICT ("roleId", "module", "action") DO NOTHING;
