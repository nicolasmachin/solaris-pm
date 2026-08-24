-- Panel de ventas (Embudo & SLA): plazo objetivo por tramo del embudo comercial.
CREATE TYPE "SalesFunnelStep" AS ENUM ('LEAD_TO_QUOTE', 'QUOTE_TO_SCHEDULED', 'SCHEDULED_TO_VISIT', 'VISIT_TO_CLOSE', 'CLOSE_TO_PROJECT');

CREATE TABLE "sales_stage_slas" (
    "id" TEXT NOT NULL,
    "step" "SalesFunnelStep" NOT NULL,
    "diasHabiles" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "sales_stage_slas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_stage_slas_step_key" ON "sales_stage_slas"("step");
