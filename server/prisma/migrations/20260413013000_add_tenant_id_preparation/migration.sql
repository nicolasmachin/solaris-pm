-- AlterTable
ALTER TABLE "users" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "projects" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "sales_leads" ADD COLUMN "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX "projects_tenantId_idx" ON "projects"("tenantId");
CREATE INDEX "sales_leads_tenantId_idx" ON "sales_leads"("tenantId");

-- CreateIndex
CREATE INDEX "stages_projectId_order_idx" ON "stages"("projectId", "order");
CREATE INDEX "stages_status_idx" ON "stages"("status");
CREATE INDEX "substages_stageId_idx" ON "substages"("stageId");
CREATE INDEX "substages_status_idx" ON "substages"("status");
CREATE INDEX "checklist_items_completed_idx" ON "checklist_items"("completed");
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "audit_logs_projectId_timestamp_idx" ON "audit_logs"("projectId", "timestamp");
CREATE INDEX "notifications_projectId_idx" ON "notifications"("projectId");
