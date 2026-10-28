// Avisos push (Web Push) al celular o la computadora.
//
// No hay un canal aparte: toda notificación interna con destinatario
// (createNotification con userId) sale además como push a cada dispositivo
// donde esa persona activó los avisos. Así lo que ya avisa la campanita llega
// también con Voltia PM cerrado, y no hay dos listas de "qué se avisa".
//
// Sin VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no se manda nada y la pantalla no
// ofrece activarlos (pushHabilitado()).

import webpush from "web-push";

import { prisma } from "../../lib/prisma.js";

/** Después de tantos errores seguidos (que no sean "ya no existe") se borra. */
const MAX_FALLOS = 5;

let configurado: boolean | null = null;

export function pushHabilitado(): boolean {
  if (configurado !== null) return configurado;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configurado = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:nicolas@voltia.com.uy", pub, priv);
  return (configurado = true);
}

export function clavePublica(): string | null {
  return pushHabilitado() ? process.env.VAPID_PUBLIC_KEY! : null;
}

export async function guardarSuscripcion(
  userId: string,
  s: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null,
) {
  // El mismo navegador puede pasar a otra persona (cierra sesión y entra otro):
  // el endpoint es único, así que queda de quien la activó último.
  await prisma.pushSuscripcion.upsert({
    where: { endpoint: s.endpoint },
    create: { userId, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent },
    update: { userId, p256dh: s.keys.p256dh, auth: s.keys.auth, userAgent, fallos: 0 },
  });
}

export async function borrarSuscripcion(userId: string, endpoint: string) {
  await prisma.pushSuscripcion.deleteMany({ where: { userId, endpoint } });
}

export type AvisoPush = {
  titulo: string;
  cuerpo: string;
  /** Ruta de Voltia PM a la que lleva al tocarlo. */
  url?: string | null;
  /** Avisos con la misma etiqueta se reemplazan en vez de apilarse. */
  etiqueta?: string | null;
};

/**
 * Manda el aviso a todos los dispositivos de la persona. Nunca tira: un aviso
 * que no sale no puede romper lo que lo disparó.
 */
export async function enviarPush(userId: string, aviso: AvisoPush): Promise<number> {
  if (!pushHabilitado()) return 0;
  try {
    const subs = await prisma.pushSuscripcion.findMany({ where: { userId } });
    if (subs.length === 0) return 0;
    const payload = JSON.stringify({
      title: aviso.titulo,
      body: aviso.cuerpo,
      url: aviso.url || "/",
      tag: aviso.etiqueta ?? undefined,
    });
    let enviados = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 24 * 3600, urgency: "normal" },
          );
          enviados++;
          await prisma.pushSuscripcion.update({
            where: { id: s.id },
            data: { fallos: 0, ultimoEnvioEn: new Date() },
          });
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404/410: el navegador dio de baja la suscripción (desinstaló,
          // borró datos, revocó el permiso). No vuelve: se borra.
          if (status === 404 || status === 410 || s.fallos + 1 >= MAX_FALLOS) {
            await prisma.pushSuscripcion.delete({ where: { id: s.id } }).catch(() => undefined);
          } else {
            await prisma.pushSuscripcion
              .update({ where: { id: s.id }, data: { fallos: { increment: 1 } } })
              .catch(() => undefined);
            console.error(`[push] no salió a ${s.id} (${status ?? "sin código"}):`, (err as Error).message);
          }
        }
      }),
    );
    return enviados;
  } catch (err) {
    console.error("[push] error mandando avisos:", err);
    return 0;
  }
}
