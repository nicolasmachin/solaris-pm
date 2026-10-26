-- Permisos iniciales de Documentación y RRHH. Va en una migración aparte porque
-- Postgres no deja usar un valor de enum en la misma transacción que lo agrega.
-- Después se ajustan desde la matriz de permisos; re-correr no pisa nada.

-- VIEW de los dos módulos: todos los roles internos (no el portal de clientes).
-- En RRHH, VIEW es solo "Mi legajo": lo propio.
INSERT INTO "permissions" ("id", "roleId", "module", "action")
SELECT md5(random()::text || r."id" || m.modulo), r."id", m.modulo::"Module", 'VIEW'::"Action"
FROM "roles" r
CROSS JOIN (VALUES ('DOCUMENTACION'), ('RRHH')) AS m(modulo)
WHERE r."name" <> 'CLIENT'
ON CONFLICT ("roleId", "module", "action") DO NOTHING;

-- Gestionar la intranet: administración.
INSERT INTO "permissions" ("id", "roleId", "module", "action")
SELECT md5(random()::text || r."id" || 'DOC_EDIT'), r."id", 'DOCUMENTACION'::"Module", 'EDIT'::"Action"
FROM "roles" r
WHERE r."name" = 'ADMIN'
ON CONFLICT ("roleId", "module", "action") DO NOTHING;

-- Legajos de todos (sueldos, contratos, datos de salud): gerencia y finanzas.
INSERT INTO "permissions" ("id", "roleId", "module", "action")
SELECT md5(random()::text || r."id" || 'RRHH_EDIT'), r."id", 'RRHH'::"Module", 'EDIT'::"Action"
FROM "roles" r
WHERE r."name" IN ('ADMIN', 'GERENTE_FINANZAS', 'FINANZAS')
ON CONFLICT ("roleId", "module", "action") DO NOTHING;
