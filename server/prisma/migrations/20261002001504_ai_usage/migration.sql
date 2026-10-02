-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "cacheRead" INTEGER NOT NULL DEFAULT 0,
    "cacheWrite" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" DECIMAL(10,2),
    "costUsd" DECIMAL(10,6),
    "durationMs" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "userId" TEXT,
    "projectId" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_feature_createdAt_idx" ON "ai_usage"("feature", "createdAt");
