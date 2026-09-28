-- Los agujeros de amure no se le piden al fabricante: el gabinete se entrega
-- sin ninguna perforación y Voltia los hace en obra.
ALTER TABLE "cabinet_designs" DROP COLUMN "agujeroAmureDiamMm";
ALTER TABLE "cabinet_designs" DROP COLUMN "agujerosAmureVertical";
ALTER TABLE "cabinet_designs" DROP COLUMN "agujerosAmureHorizontal";
