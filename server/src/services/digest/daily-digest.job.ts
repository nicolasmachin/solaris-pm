import cron from "node-cron";

import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../email.service.js";
import { emailDailyDigest, type DigestGroup } from "../email.templates.js";
import { getDigestSendHour, getEnabledByRole } from "./digest-config.service.js";

// Resumen diario por persona: junta las notificaciones in-app de las últimas N
// horas de cada usuario interno y manda UN solo mail agrupado por proyecto.
// Reemplaza los mails por evento (traspasos, escalaciones, ingeniería, avisos).
//
// Qué tipo de notificación entra al resumen se define por ROL en Administración
// (matriz opt-in): sin config, un rol no recibe nada. La hora de envío también
// es configurable (una sola para todos). Usuarios sin novedades habilitadas no
// reciben nada. Los clientes (rol CLIENT) nunca entran al digest.

function getVentanaHoras(): number {
  const raw = Number(process.env.DIGEST_VENTANA_HORAS);
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

// Hora actual (0-23) en horario de Uruguay, para comparar contra la hora
// configurada de envío sin depender del TZ del contenedor.
function horaUruguay(now: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Montevideo",
    hour: "numeric",
    hour12: false,
  });
  const raw = fmt.format(now); // "0".."23" (a veces "24" a medianoche en algunos runtimes)
  const h = Number.parseInt(raw, 10);
  return h === 24 ? 0 : h;
}

export async function enviarDigestDiario(
  now: Date = new Date(),
): Promise<{ users: number; emails: number; notifs: number }> {
  const desde = new Date(now.getTime() - getVentanaHoras() * 60 * 60 * 1000);

  const notifs = await prisma.notification.findMany({
    where: {
      createdAt: { gte: desde, lte: now },
      userId: { not: null },
    },
    include: { project: { select: { id: true, clientName: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (notifs.length === 0) return { users: 0, emails: 0, notifs: 0 };

  // Agrupar por usuario.
  const byUser = new Map<string, typeof notifs>();
  for (const n of notifs) {
    if (!n.userId) continue;
    const bucket = byUser.get(n.userId) ?? [];
    bucket.push(n);
    byUser.set(n.userId, bucket);
  }

  // Traer usuarios internos con email (excluye CLIENT) + su rol.
  const users = await prisma.user.findMany({
    where: {
      id: { in: [...byUser.keys()] },
      deletedAt: null,
      email: { not: "" },
      role: { name: { not: "CLIENT" } },
    },
    select: { id: true, name: true, email: true, role: { select: { name: true } } },
  });

  const enabledByRole = await getEnabledByRole();

  let emails = 0;
  let usersWithDigest = 0;
  for (const user of users) {
    const enabled = enabledByRole.get(user.role?.name ?? "") ?? new Set();
    // Opt-in: solo los tipos habilitados para el rol de este usuario.
    const items = (byUser.get(user.id) ?? []).filter((n) => enabled.has(n.type));
    if (items.length === 0) continue;
    usersWithDigest++;

    // Agrupar por proyecto dentro del usuario.
    const groupsMap = new Map<string, DigestGroup>();
    for (const n of items) {
      const key = n.project?.id ?? "__general__";
      const group = groupsMap.get(key) ?? {
        projectName: n.project?.clientName ?? null,
        projectId: n.project?.id ?? null,
        items: [],
      };
      group.items.push({ title: n.title, message: n.message });
      groupsMap.set(key, group);
    }
    // Proyectos primero, "General" al final.
    const groups = [...groupsMap.values()].sort((a, b) => {
      if (a.projectName === null) return 1;
      if (b.projectName === null) return -1;
      return a.projectName.localeCompare(b.projectName);
    });

    const template = emailDailyDigest({
      userName: user.name,
      groups,
      totalCount: items.length,
    });
    const ok = await sendEmail({ to: user.email, ...template, type: "internal" });
    if (ok) emails++;
  }

  return { users: usersWithDigest, emails, notifs: notifs.length };
}

// Cron: corre cada hora en punto y envía SOLO cuando la hora de Uruguay coincide
// con la hora configurada en Administración (default 08:00). Así la hora se
// cambia desde la app sin reprogramar el cron.
export function startDailyDigestJob() {
  const expr = process.env.CRON_DAILY_DIGEST || "0 * * * *";
  return cron.schedule(expr, async () => {
    try {
      const now = new Date();
      const sendHour = await getDigestSendHour();
      if (horaUruguay(now) !== sendHour) return;
      const r = await enviarDigestDiario(now);
      if (r.emails > 0) {
        console.log(`[daily-digest] ${r.notifs} notificaciones → ${r.emails} mails a ${r.users} usuarios`);
      }
    } catch (err) {
      console.error("[daily-digest] job error:", err);
    }
  });
}
