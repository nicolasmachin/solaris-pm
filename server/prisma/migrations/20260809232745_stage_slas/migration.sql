-- CreateTable
CREATE TABLE "stage_slas" (
    "id" TEXT NOT NULL,
    "stageType" "StageType" NOT NULL,
    "diasHabiles" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stage_slas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stage_slas_stageType_key" ON "stage_slas"("stageType");
