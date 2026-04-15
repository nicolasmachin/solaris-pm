ALTER TABLE "stages"
ADD COLUMN "responsibleName" TEXT;

ALTER TABLE "checklist_items"
ADD COLUMN "notes" TEXT,
ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;
