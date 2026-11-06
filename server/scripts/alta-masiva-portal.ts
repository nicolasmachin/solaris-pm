/**
 * Crea el usuario del portal a todos los clientes que todavía no lo tienen. No
 * le manda nada a nadie: el acceso se les avisa aparte.
 *
 * Quien tiene mail entra con el código que le llega ahí, sin contraseña. Por eso
 * se le pone una al azar que nadie conoce y sin la marca de temporal: con la
 * marca, el portal lo obliga a cambiarla y le pide la actual. Si después quiere
 * una, la pide con "Reenviar acceso".
 *
 * Quien no tiene mail queda con usuario (cédula o alias) y con la marca: para
 * entrar necesita que Experiencia Solar le mande una con "Reenviar acceso".
 *
 * El mail sale del proyecto; si no está, del lead y después de los destinatarios
 * del reporte. No toca los proyectos archivados ni los que ya tienen usuario, así
 * que se puede volver a correr.
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/alta-masiva-portal.ts                            # simula
 *     npx tsx scripts/alta-masiva-portal.ts --excluir=PRY-2026-020,GEN-0001
 *     npx tsx scripts/alta-masiva-portal.ts --aplicar --actor=mail@voltia.com.uy
 */

import crypto from "node:crypto";

import { prisma } from "../src/lib/prisma.js";
import { createPortalUserForProject } from "../src/services/clientes/portal-user.service.js";

const APLICAR = process.argv.includes("--aplicar");

function opcion(nombre: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return arg ? arg.slice(nombre.length + 3) : null;
}

const EXCLUIR = new Set((opcion("excluir") ?? "").split(",").map((c) => c.trim()).filter(Boolean));
const MAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const actorMail = opcion("actor");
  const actor = actorMail
    ? await prisma.user.findFirst({ where: { email: actorMail, deletedAt: null }, select: { id: true } })
    : null;
  if (APLICAR && !actor) throw new Error("Para aplicar hace falta --actor=<mail de un usuario existente>");

  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null, status: { not: "ARCHIVED" }, clients: { none: {} } },
    select: {
      id: true,
      code: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      convertedLeads: { where: { deletedAt: null }, select: { clientEmail: true }, take: 1 },
      reporteFvConfig: {
        select: { destinatarios: { where: { activo: true, esCopia: false }, select: { email: true }, take: 1 } },
      },
    },
    orderBy: { code: "asc" },
  });

  const cuenta = { conMail: 0, sinMail: 0, excluidos: 0, errores: 0 };
  for (const p of proyectos) {
    if (EXCLUIR.has(p.code)) {
      cuenta.excluidos++;
      console.log(`EXCLUIDO  ${p.code}  ${p.clientName}`);
      continue;
    }
    const candidatos: Array<[string | null | undefined, string]> = [
      [p.clientEmail, "proyecto"],
      [p.convertedLeads[0]?.clientEmail, "lead"],
      [p.reporteFvConfig?.destinatarios[0]?.email, "reporte"],
    ];
    const elegido = candidatos.find(([m]) => m && MAIL_VALIDO.test(m.trim()));
    const email = elegido?.[0]?.trim() ?? null;

    if (email) cuenta.conMail++;
    else cuenta.sinMail++;
    console.log(`${email ? "MAIL     " : "SIN MAIL "} ${p.code}  ${p.clientName}  ${email ?? ""}${email ? ` (${elegido![1]})` : ""}`);
    if (!APLICAR) continue;

    try {
      await createPortalUserForProject({
        projectId: p.id,
        name: p.clientName,
        email,
        temporaryPassword: crypto.randomBytes(24).toString("base64url"),
        passwordTemporary: !email,
        phone: p.clientPhone,
        actorUserId: actor!.id,
      });
    } catch (err) {
      cuenta.errores++;
      console.error(`ERROR     ${p.code}: ${(err as Error).message}`);
    }
  }

  console.log(`\n${APLICAR ? "Aplicado" : "Simulación"}: ${JSON.stringify(cuenta)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
