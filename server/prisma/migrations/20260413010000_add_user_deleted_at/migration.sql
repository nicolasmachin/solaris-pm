ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");
