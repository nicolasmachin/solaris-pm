-- Hacer `Task.projectId` opcional. Tareas con projectId NULL son "tareas
-- sueltas" (standalone), no atadas a ningún proyecto. Migración no
-- destructiva: las tareas existentes mantienen su projectId; solo se
-- relaja la constraint NOT NULL. La FK con onDelete CASCADE se preserva
-- al recrearla.

ALTER TABLE "tasks" ALTER COLUMN "projectId" DROP NOT NULL;
