-- Migración: enum Role → tabla roles (roles dinámicos, editables desde admin)
-- Preserva todos los datos: backfill de users.roleId y permissions.roleId desde el enum.

-- 1. Crear tabla roles
CREATE TABLE "roles" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "description" TEXT,
  "isSystem"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- 2. Poblar con los 5 roles sistema (isSystem = true)
INSERT INTO "roles" ("id", "name", "label", "isSystem", "createdAt", "updatedAt") VALUES
  ('role_admin',        'ADMIN',            'Administrador',    true, NOW(), NOW()),
  ('role_operaciones',  'OPERACIONES',      'Operaciones',      true, NOW(), NOW()),
  ('role_ingenieria',   'INGENIERIA',       'Ingeniería',       true, NOW(), NOW()),
  ('role_comercial',    'ASESOR_COMERCIAL', 'Asesor comercial', true, NOW(), NOW()),
  ('role_finanzas',     'FINANZAS',         'Finanzas',         true, NOW(), NOW());

-- 3. Agregar columnas roleId (nullable por ahora, para poder backfillear)
ALTER TABLE "users"       ADD COLUMN "roleId" TEXT;
ALTER TABLE "permissions" ADD COLUMN "roleId" TEXT;

-- 4. Backfill: copiar enum → roleId por nombre
UPDATE "users" u
  SET "roleId" = r.id
  FROM "roles" r
  WHERE u."role"::text = r.name;

UPDATE "permissions" p
  SET "roleId" = r.id
  FROM "roles" r
  WHERE p."role"::text = r.name;

-- 5. Verificar que nadie quedó sin roleId (aborta la migración si hay nulls)
DO $$
DECLARE
  v_users_nulos       INTEGER;
  v_permissions_nulos INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users_nulos       FROM "users"       WHERE "roleId" IS NULL;
  SELECT COUNT(*) INTO v_permissions_nulos FROM "permissions" WHERE "roleId" IS NULL;
  IF v_users_nulos > 0 OR v_permissions_nulos > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % users sin roleId, % permissions sin roleId',
      v_users_nulos, v_permissions_nulos;
  END IF;
END $$;

-- 6. Hacer roleId NOT NULL
ALTER TABLE "users"       ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "permissions" ALTER COLUMN "roleId" SET NOT NULL;

-- 7. Reemplazar el unique/index viejo de permissions con uno sobre roleId
DROP INDEX IF EXISTS "permissions_role_module_action_key";
DROP INDEX IF EXISTS "permissions_role_idx";
CREATE UNIQUE INDEX "permissions_roleId_module_action_key" ON "permissions"("roleId", "module", "action");
CREATE INDEX "permissions_roleId_idx" ON "permissions"("roleId");

-- 8. Drop columnas viejas tipo enum
ALTER TABLE "users"       DROP COLUMN "role";
ALTER TABLE "permissions" DROP COLUMN "role";

-- 9. FKs
ALTER TABLE "users"
  ADD CONSTRAINT "users_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "permissions"
  ADD CONSTRAINT "permissions_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "roles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. Drop enum type
DROP TYPE "Role";
