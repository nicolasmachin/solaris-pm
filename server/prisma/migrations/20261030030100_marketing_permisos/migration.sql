-- Rol MARKETING y permisos iniciales del módulo Marketing. Va en una migración
-- aparte porque Postgres no deja usar un valor de enum en la misma transacción
-- que lo agrega. Después se ajusta desde la matriz de permisos; re-correr no
-- pisa nada.

INSERT INTO "roles" ("id", "name", "label", "description", "isSystem", "createdAt", "updatedAt")
VALUES (md5(random()::text || 'MARKETING'), 'MARKETING', 'Marketing',
        'Bandeja de privados de Instagram y, más adelante, los WhatsApp de los anuncios.',
        true, now(), now())
ON CONFLICT ("name") DO NOTHING;

-- Ver y contestar: Marketing y administración.
INSERT INTO "permissions" ("id", "roleId", "module", "action")
SELECT md5(random()::text || r."id" || a.accion), r."id", 'MARKETING'::"Module", a.accion::"Action"
FROM "roles" r
CROSS JOIN (VALUES ('VIEW'), ('EDIT')) AS a(accion)
WHERE r."name" IN ('ADMIN', 'MARKETING')
ON CONFLICT ("roleId", "module", "action") DO NOTHING;

-- Todos los roles internos leen la Documentación y su legajo (igual que en
-- 20261026163700_documentacion_rrhh_permisos): el rol nuevo también.
INSERT INTO "permissions" ("id", "roleId", "module", "action")
SELECT md5(random()::text || r."id" || m.modulo), r."id", m.modulo::"Module", 'VIEW'::"Action"
FROM "roles" r
CROSS JOIN (VALUES ('DOCUMENTACION'), ('RRHH')) AS m(modulo)
WHERE r."name" = 'MARKETING'
ON CONFLICT ("roleId", "module", "action") DO NOTHING;
