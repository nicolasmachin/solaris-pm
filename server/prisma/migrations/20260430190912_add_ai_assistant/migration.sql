-- CreateEnum
CREATE TYPE "AIQueryStatus" AS ENUM ('SUCCESS', 'SQL_INVALID', 'EXECUTION_ERROR', 'RATE_LIMIT_EXCEEDED', 'PERMISSION_DENIED', 'AI_ERROR');

-- CreateTable
CREATE TABLE "ai_queries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "generatedSQL" TEXT,
    "result" JSONB,
    "response" TEXT,
    "status" "AIQueryStatus" NOT NULL,
    "errorMessage" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "costUSD" DECIMAL(10,6),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_rate_limits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "queriesPerDay" INTEGER NOT NULL DEFAULT 100,
    "costUSDPerMonth" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ai_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_queries_userId_createdAt_idx" ON "ai_queries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_queries_status_idx" ON "ai_queries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_rate_limits_userId_key" ON "ai_rate_limits"("userId");

-- AddForeignKey
ALTER TABLE "ai_queries" ADD CONSTRAINT "ai_queries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_rate_limits" ADD CONSTRAINT "ai_rate_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
