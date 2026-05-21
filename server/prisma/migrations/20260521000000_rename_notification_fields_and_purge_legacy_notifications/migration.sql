-- Incidente mayo 2026: el campo Project.notificationEmail tenía emails de
-- clientes y el sistema de notificaciones automaticas lo usaba como
-- destinatario. Esto causó envio de informacion interna a clientes.
--
-- Cambios:
-- 1) Renombrar Project.notificationEmail -> clientEmail (preservar datos).
-- 2) Renombrar Project.notificationPhone -> clientPhone (preservar datos).
-- 3) Eliminar de la tabla notifications todos los registros de los 6 tipos
--    que iban via el flujo roto antes de eliminar los valores del enum.
-- 4) Reducir el enum NotificationType eliminando esos 6 valores.

-- 1) Renombrar columnas (preserva los datos existentes).
ALTER TABLE "projects" RENAME COLUMN "notificationEmail" TO "clientEmail";
ALTER TABLE "projects" RENAME COLUMN "notificationPhone" TO "clientPhone";

-- 2) Purgar notificaciones de los 6 tipos obsoletos antes de tocar el enum.
DELETE FROM "notifications"
WHERE "type" IN (
  'task_due',
  'stage_changed',
  'progress_milestone',
  'substage_blocked',
  'stage_overdue',
  'project_delayed'
);

-- 3) Reducir el enum NotificationType. Postgres no permite remover valores
--    in-place: hay que crear un enum nuevo, migrar las columnas y dropear
--    el viejo.
CREATE TYPE "NotificationType_new" AS ENUM (
  'goals_not_configured',
  'deadline_warning',
  'prev_substage_completed',
  'engineering_completed'
);

ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType_new"
  USING ("type"::text::"NotificationType_new");

DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
