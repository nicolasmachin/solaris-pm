-- Hacer opcionales varios campos de Project que antes eran obligatorios.
-- Motivación: al crear un proyecto sólo deben ser obligatorios clientName,
-- capacityKwp, locationCity, locationProvince. El resto puede cargarse después.
ALTER TABLE "projects" ALTER COLUMN "plannedEndDate"    DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "budgetUsd"         DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "estimatedMwhYear"  DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "co2TonsAvoided"    DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "notificationEmail" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "notificationPhone" DROP NOT NULL;
