import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { checkGoalsConfigured, startGoalsCheckJob } from "./services/alerts.service.js";
import { startBcuRateJob, syncBcuRate } from "./services/exchange-rate.service.js";
import { startDeadlineWarningsJob } from "./services/deadline-warnings.service.js";
import { startTraspasosJobs } from "./services/traspasos/index.js";
import { startAvisoHabilitacionJob } from "./services/clientes/aviso-habilitacion.service.js";
import { startEncuestasAniversarioJob } from "./services/encuestas/aniversario.job.js";
import { formatErrorPayload } from "./utils/errors.js";

if (process.env.NODE_ENV === "production") {
  console.log("Servidor corriendo en PRODUCCIÓN");
}

async function buildServer() {
  const app = Fastify({
    logger: env.nodeEnv !== "test",
  });

  const absoluteStoragePath = path.resolve(process.cwd(), "..", env.storagePath);
  fs.mkdirSync(absoluteStoragePath, { recursive: true });

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.maxFileSizeMb * 1024 * 1024,
      files: 1,
    },
  });

  app.setErrorHandler((error, _request, reply) => {
    const formatted = formatErrorPayload(error);
    if (formatted.statusCode === 500) {
      app.log.error(error);
    }
    reply.status(formatted.statusCode).send(formatted.payload);
  });

  await registerRoutes(app);

  return app;
}

async function start() {
  const app = await buildServer();
  startGoalsCheckJob();
  startBcuRateJob();
  startDeadlineWarningsJob();
  startTraspasosJobs();
  startAvisoHabilitacionJob();
  startEncuestasAniversarioJob();

  // Startup check: notify admins if no goals for current quarter
  checkGoalsConfigured().catch((err) => console.error("[startup] checkGoalsConfigured failed:", err));

  // Sync BCU exchange rate on boot too (no esperamos al primer tick del cron).
  syncBcuRate().catch((err) => console.error("[startup] syncBcuRate failed:", err));

  try {
    await app.listen({
      host: "0.0.0.0",
      port: env.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
