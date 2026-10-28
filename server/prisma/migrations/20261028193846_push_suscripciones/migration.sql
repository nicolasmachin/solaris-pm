-- CreateTable
CREATE TABLE "push_suscripciones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "fallos" INTEGER NOT NULL DEFAULT 0,
    "ultimoEnvioEn" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_suscripciones_endpoint_key" ON "push_suscripciones"("endpoint");

-- CreateIndex
CREATE INDEX "push_suscripciones_userId_idx" ON "push_suscripciones"("userId");

-- AddForeignKey
ALTER TABLE "push_suscripciones" ADD CONSTRAINT "push_suscripciones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
