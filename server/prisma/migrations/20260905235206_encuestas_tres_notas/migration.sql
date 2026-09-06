-- AlterEnum
ALTER TYPE "SettingKey" ADD VALUE 'ENCUESTA_NOTA_BAJA_MAX';

-- AlterTable
ALTER TABLE "satisfaction_surveys" ADD COLUMN     "nota2" INTEGER,
ADD COLUMN     "nota3" INTEGER;
