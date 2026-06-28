-- CreateEnum
CREATE TYPE "InteractionChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'LLAMADA', 'VISITA', 'OTRO');

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'client_interaction';

-- AlterEnum
ALTER TYPE "Module" ADD VALUE 'EXPERIENCIA_CLIENTES';

-- CreateTable
CREATE TABLE "client_interactions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channel" "InteractionChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_interactions_projectId_createdAt_idx" ON "client_interactions"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_interactions" ADD CONSTRAINT "client_interactions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
