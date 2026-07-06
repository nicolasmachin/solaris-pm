-- DropForeignKey
ALTER TABLE "commissions" DROP CONSTRAINT "commissions_leadId_fkey";

-- AlterTable
ALTER TABLE "commissions" ADD COLUMN     "concepto" TEXT,
ALTER COLUMN "leadId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "sales_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
