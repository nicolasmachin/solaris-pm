-- Omitir proyectos de métricas y SLA (proyectos viejos/de seguimiento que distorsionan indicadores).
ALTER TABLE "projects" ADD COLUMN "excludedFromMetrics" BOOLEAN NOT NULL DEFAULT false;
