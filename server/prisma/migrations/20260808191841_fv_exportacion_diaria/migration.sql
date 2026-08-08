-- AlterTable
ALTER TABLE "growatt_devices" ADD COLUMN     "meterAddress" TEXT;

-- AlterTable
ALTER TABLE "reporte_fv_generaciones_diarias" ADD COLUMN     "exportacionKwh" DECIMAL(10,2);
