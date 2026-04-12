import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { startAlertsJob } from "./services/alerts.service.js";
import { formatErrorPayload } from "./utils/errors.js";

async function buildServer() {
  const app = Fastify({
    logger: env.nodeEnv !== "test",
  });

  const absoluteStoragePath = path.resolve(process.cwd(), "..", env.storagePath);
  fs.mkdirSync(absoluteStoragePath, { recursive: true });

  await app.register(cors, {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
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
  const alertsJob = startAlertsJob();

  try {
    await app.listen({
      host: "0.0.0.0",
      port: env.port,
    });
  } catch (error) {
    alertsJob.stop();
    app.log.error(error);
    process.exit(1);
  }
}

void start();
