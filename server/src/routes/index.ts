import type { FastifyInstance } from "fastify";

import { registerApiRoutes } from "./api.routes.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerClientesRoutes } from "./clientes.routes.js";
import { registerCommissionRoutes } from "./commission.routes.js";
import { registerConsolidadorRoutes } from "./consolidador.routes.js";
import { registerContractRoutes } from "./contract.routes.js";
import { registerEFPRoutes } from "./efp.routes.js";
import { registerEmailRoutes } from "./email.routes.js";
import { registerVideosRoutes } from "./videos.routes.js";
import { registerInformesRoutes } from "./informes.routes.js";
import { registerIngenieriaRoutes } from "./ingenieria.routes.js";
import { registerMaterialTemplatesRoutes } from "./material-templates.routes.js";
import { registerPortalRoutes } from "./portal.routes.js";
import { registerProformaRoutes } from "./proforma.routes.js";
import { registerPreIngenieriaRoutes } from "./preingenieria.routes.js";
import { registerProposalsV2DefaultsRoutes } from "./proposals-v2-defaults.routes.js";
import { registerProposalsV2DraftsVersionsRoutes } from "./proposals-v2-drafts-versions.routes.js";
import { registerProposalsV2PreviewRoutes } from "./proposals-v2-preview.routes.js";
import { registerReportesFvRoutes } from "./reportes-fv.routes.js";
import { registerSalesRoutes } from "./sales.routes.js";
import { registerTicketsRoutes } from "./tickets.routes.js";
import { registerEncuestasRoutes } from "./encuestas.routes.js";
import { registerTraspasosRoutes } from "./traspasos.routes.js";
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
  await app.register(registerMaterialTemplatesRoutes, { prefix: "/api" });
  await app.register(registerVisitasRoutes, { prefix: "/api" });
  await app.register(registerEFPRoutes, { prefix: "/api" });
  await app.register(registerSalesRoutes, { prefix: "/api" });
  await app.register(registerProposalsV2DefaultsRoutes, { prefix: "/api" });
  await app.register(registerProposalsV2PreviewRoutes, { prefix: "/api" });
  await app.register(registerProposalsV2DraftsVersionsRoutes, { prefix: "/api" });
  await app.register(registerInformesRoutes, { prefix: "/api" });
  await app.register(registerEmailRoutes, { prefix: "/api" });
  await app.register(registerClientesRoutes, { prefix: "/api" });
  await app.register(registerCommissionRoutes, { prefix: "/api" });
  await app.register(registerContractRoutes, { prefix: "/api" });
  await app.register(registerProformaRoutes, { prefix: "/api" });
  await app.register(registerTraspasosRoutes, { prefix: "/api" });
  await app.register(registerTicketsRoutes, { prefix: "/api" });
  await app.register(registerEncuestasRoutes, { prefix: "/api" });
  await app.register(registerReportesFvRoutes, { prefix: "/api" });
  await app.register(registerVideosRoutes, { prefix: "/api" });
}
