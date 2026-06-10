import type { FastifyInstance } from "fastify";

import { registerApiRoutes } from "./api.routes.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerConsolidadorRoutes } from "./consolidador.routes.js";
import { registerEFPRoutes } from "./efp.routes.js";
import { registerInformesRoutes } from "./informes.routes.js";
import { registerIngenieriaRoutes } from "./ingenieria.routes.js";
import { registerPortalRoutes } from "./portal.routes.js";
import { registerPreIngenieriaRoutes } from "./preingenieria.routes.js";
import { registerSalesRoutes } from "./sales.routes.js";
import { registerUnifilarRoutes } from "./unifilar.routes.js";
import { registerVisitasRoutes } from "./visitas.routes.js";

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
  await app.register(registerUnifilarRoutes, { prefix: "/api" });
  await app.register(registerIngenieriaRoutes, { prefix: "/api" });
  await app.register(registerPreIngenieriaRoutes, { prefix: "/api" });
  await app.register(registerConsolidadorRoutes, { prefix: "/api" });
  await app.register(registerVisitasRoutes, { prefix: "/api" });
  await app.register(registerEFPRoutes, { prefix: "/api" });
  await app.register(registerSalesRoutes, { prefix: "/api" });
  await app.register(registerInformesRoutes, { prefix: "/api" });
}
