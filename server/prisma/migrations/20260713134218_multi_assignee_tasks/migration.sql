-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignees_userId_idx" ON "task_assignees"("userId");

-- CreateIndex
CREATE INDEX "task_assignees_taskId_idx" ON "task_assignees"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_userId_key" ON "task_assignees"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada tarea con un responsable (userId) obtiene su fila de assignee,
-- para que la nueva fuente de verdad (task_assignees) refleje el estado actual.
-- Solo tareas no borradas con userId apuntando a un usuario existente.
INSERT INTO "task_assignees" ("id", "taskId", "userId", "createdAt")
SELECT gen_random_uuid()::text, t."id", t."userId", CURRENT_TIMESTAMP
FROM "tasks" t
WHERE t."userId" IS NOT NULL
  AND t."deletedAt" IS NULL
  AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = t."userId")
ON CONFLICT ("taskId", "userId") DO NOTHING;
