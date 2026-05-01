import type { FastifyInstance } from "fastify";

import { registerApiRoutes } from "./api.routes.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerPortalRoutes } from "./portal.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "voltia-pm-server",
      timestamp: new Date().toISOString(),
    };
  });

  await registerAuthRoutes(app);
  await app.register(registerApiRoutes, { prefix: "/api" });
  await app.register(registerPortalRoutes, { prefix: "/api" });
}
