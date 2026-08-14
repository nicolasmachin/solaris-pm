-- CreateEnum
CREATE TYPE "ProposalVariante" AS ENUM ('RESIDENCIAL', 'EMPRESA');

-- DropIndex
DROP INDEX "proposal_v2_drafts_leadId_key";

-- AlterTable
ALTER TABLE "proposal_v2_drafts" ADD COLUMN     "variante" "ProposalVariante" NOT NULL DEFAULT 'RESIDENCIAL';

-- AlterTable
ALTER TABLE "sales_leads" ADD COLUMN     "tipoCliente" "ProposalVariante" NOT NULL DEFAULT 'RESIDENCIAL';

-- CreateIndex
CREATE UNIQUE INDEX "proposal_v2_drafts_leadId_variante_key" ON "proposal_v2_drafts"("leadId", "variante");

