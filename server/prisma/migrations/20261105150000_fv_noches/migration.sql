-- CreateTable
CREATE TABLE "fv_noches" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "kwh" DECIMAL(10,2) NOT NULL,
    "desde" TIMESTAMPTZ(6) NOT NULL,
    "hasta" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fv_noches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fv_noches_projectId_fecha_key" ON "fv_noches"("projectId", "fecha");

-- AddForeignKey
ALTER TABLE "fv_noches" ADD CONSTRAINT "fv_noches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
