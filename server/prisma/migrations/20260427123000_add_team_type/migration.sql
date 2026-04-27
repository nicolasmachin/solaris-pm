CREATE TYPE "TeamType" AS ENUM ('PROPIO', 'TERCERIZADO');

ALTER TABLE "teams"
ADD COLUMN "type" "TeamType" NOT NULL DEFAULT 'PROPIO';

ALTER TABLE "installation_schedules"
ADD COLUMN "teamType" "TeamType" NOT NULL DEFAULT 'PROPIO';

UPDATE "installation_schedules" s
SET "teamType" = t."type"
FROM "teams" t
WHERE s."teamId" = t."id";
