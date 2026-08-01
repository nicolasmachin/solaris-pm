-- Unificación de roles (jul-2026): se elimina el mecanismo de sub-roles de
-- Operaciones. Nunca se asignaba en ningún lado (columna vacía) y el ruteo de
-- traspasos ahora es 100% por ROL real (GERENTE_OPERACIONES / CAPATAZ /
-- LOGISTICA). Ver server/src/services/traspasos/catalogo.ts.
ALTER TABLE "users" DROP COLUMN "subRolesOperaciones";
DROP TYPE "SubRolOperaciones";
