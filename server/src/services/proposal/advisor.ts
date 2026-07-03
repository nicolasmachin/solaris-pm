// Resolución del asesor que firma la carta de presentación, con el fallback en
// dos capas de Fase F:
//   - jobTitle vacío/null → "Asesor Comercial".
//   - name vacío/null → "Voltia" (caso extremo: usuario inaccesible).
// El snapshot de una versión guarda advisor {name, jobTitle, email}; al
// regenerar versiones viejas (sin advisor) se cae al publishedBy de la BD.

import { prisma } from "../../lib/prisma.js";
import type { ProposalAdvisor } from "./template.js";

export function buildAdvisor(input: {
  name?: string | null;
  jobTitle?: string | null;
  email?: string | null;
}): ProposalAdvisor {
  return {
    name: input.name?.trim() || "Voltia",
    jobTitle: input.jobTitle?.trim() || "Asesor Comercial",
    email: input.email?.trim() || "",
  };
}

// Advisor del usuario logueado / que publica (preview, generate, publish).
export async function resolveAdvisorForUser(userId: string): Promise<ProposalAdvisor> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, jobTitle: true, email: true },
  });
  return buildAdvisor(u ?? {});
}
