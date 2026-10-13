-- AlterTable
ALTER TABLE "reporte_fv_generaciones_diarias" ADD COLUMN     "consumoKwh" DECIMAL(10,2),
ADD COLUMN     "importacionKwh" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "fv_curvas_dia" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "puntos" JSONB NOT NULL,
    "generacionKwh" DECIMAL(10,2),
    "consumoKwh" DECIMAL(10,2),
    "importacionKwh" DECIMAL(10,2),
    "exportacionKwh" DECIMAL(10,2),
    "origenMedicion" TEXT,
    "completo" BOOLEAN NOT NULL DEFAULT false,
    "fuente" "ReporteFvFuente" NOT NULL DEFAULT 'GROWATT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fv_curvas_dia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fv_curvas_dia_projectId_fecha_key" ON "fv_curvas_dia"("projectId", "fecha");

-- AddForeignKey
ALTER TABLE "fv_curvas_dia" ADD CONSTRAINT "fv_curvas_dia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
