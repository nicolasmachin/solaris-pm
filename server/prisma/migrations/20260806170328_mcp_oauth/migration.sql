-- CreateTable
CREATE TABLE "mcp_auth_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "rotatedToId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_auth_codes_codeHash_key" ON "mcp_auth_codes"("codeHash");

-- CreateIndex
CREATE INDEX "mcp_auth_codes_userId_idx" ON "mcp_auth_codes"("userId");

-- CreateIndex
CREATE INDEX "mcp_auth_codes_expiresAt_idx" ON "mcp_auth_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_refresh_tokens_tokenHash_key" ON "mcp_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "mcp_refresh_tokens_userId_idx" ON "mcp_refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "mcp_refresh_tokens_expiresAt_idx" ON "mcp_refresh_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "mcp_auth_codes" ADD CONSTRAINT "mcp_auth_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_refresh_tokens" ADD CONSTRAINT "mcp_refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
