-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "ubicacionEn" TIMESTAMPTZ(6),
ADD COLUMN     "ubicacionLat" DOUBLE PRECISION,
ADD COLUMN     "ubicacionLng" DOUBLE PRECISION,
ADD COLUMN     "ubicacionOrigen" TEXT;

-- AlterTable
ALTER TABLE "sales_leads" ADD COLUMN     "ubicacionEn" TIMESTAMPTZ(6),
ADD COLUMN     "ubicacionLat" DOUBLE PRECISION,
ADD COLUMN     "ubicacionLng" DOUBLE PRECISION,
ADD COLUMN     "ubicacionOrigen" TEXT;
